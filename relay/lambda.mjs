// El cartero en AWS: una Lambda detrás de un API Gateway de WebSocket.
//
// Se despierta con cada mensaje y se vuelve a dormir: no hay nada prendido esperando,
// así que sin partidas no cuesta nada. Lo que tiene que recordar entre un mensaje y
// otro —qué salas hay y quién está en cada una— va a una tabla de DynamoDB que borra
// sola lo viejo (atributo `expires`). La lógica es la misma de `npm start`: ver
// `core.mjs`. Acá solo está cómo se guarda y cómo se entrega.
//
// Los clientes del SDK vienen con el runtime de Node de Lambda: no hay nada que empaquetar.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ApiGatewayManagementApiClient, PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { createRelay } from './core.mjs';

const TableName = process.env.TABLE;
/** Lo que no se toca en seis horas, DynamoDB lo borra solo. */
const LIFE = 6 * 3600;

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const expires = () => Math.floor(Date.now() / 1000) + LIFE;
const roomKey = (code) => ({ pk: `room#${code}` });
const connKey = (conn) => ({ pk: `conn#${conn}` });

/** Una escritura que exige que la sala exista, y que no pasa nada si ya no está. */
async function ifExists(command) {
  try {
    await db.send(command);
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
  }
}

const store = {
  async getRoom(code) {
    const { Item } = await db.send(new GetCommand({ TableName, Key: roomKey(code) }));
    return Item ?? null;
  },
  async createRoom(room) {
    try {
      await db.send(new PutCommand({
        TableName,
        Item: { ...roomKey(room.code), kind: 'room', ...room, expires: expires() },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
      return true;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') return false;
      throw err;
    }
  },
  async updateRoom(code, fields) {
    const entries = Object.entries({ ...fields, expires: expires() });
    await ifExists(new UpdateCommand({
      TableName,
      Key: roomKey(code),
      UpdateExpression: `SET ${entries.map((_, i) => `#k${i} = :v${i}`).join(', ')}`,
      ExpressionAttributeNames: Object.fromEntries(entries.map(([k], i) => [`#k${i}`, k])),
      ExpressionAttributeValues: Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v])),
      ConditionExpression: 'attribute_exists(pk)',
    }));
  },
  async deleteRoom(code) {
    await db.send(new DeleteCommand({ TableName, Key: roomKey(code) }));
  },
  async setPeer(code, conn, id) {
    await ifExists(new UpdateCommand({
      TableName,
      Key: roomKey(code),
      UpdateExpression: 'SET #peers.#conn = :id',
      ExpressionAttributeNames: { '#peers': 'peers', '#conn': conn },
      ExpressionAttributeValues: { ':id': id },
      ConditionExpression: 'attribute_exists(pk)',
    }));
  },
  async removePeer(code, conn) {
    await ifExists(new UpdateCommand({
      TableName,
      Key: roomKey(code),
      UpdateExpression: 'REMOVE #peers.#conn',
      ExpressionAttributeNames: { '#peers': 'peers', '#conn': conn },
      ConditionExpression: 'attribute_exists(pk)',
    }));
  },
  async listRooms() {
    const out = [];
    let ExclusiveStartKey;
    do {
      const page = await db.send(new ScanCommand({
        TableName,
        FilterExpression: '#kind = :room',
        ExpressionAttributeNames: { '#kind': 'kind' },
        ExpressionAttributeValues: { ':room': 'room' },
        ExclusiveStartKey,
      }));
      out.push(...(page.Items ?? []));
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey && out.length < 200);
    return out;
  },
  async getConn(conn) {
    const { Item } = await db.send(new GetCommand({ TableName, Key: connKey(conn) }));
    return Item ?? null;
  },
  async putConn(conn, rec) {
    await db.send(new PutCommand({
      TableName, Item: { ...connKey(conn), kind: 'conn', ...rec, expires: expires() },
    }));
  },
  async deleteConn(conn) {
    await db.send(new DeleteCommand({ TableName, Key: connKey(conn) }));
  },
};

let api = null;
const encoder = new TextEncoder();

export async function handler(event) {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  api ??= new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });

  const relay = createRelay({
    store,
    async post(conn, text) {
      try {
        await api.send(new PostToConnectionCommand({ ConnectionId: conn, Data: encoder.encode(text) }));
        return true;
      } catch (err) {
        if (err.name === 'GoneException' || err.$metadata?.httpStatusCode === 410) return false;
        throw err;
      }
    },
  });

  try {
    if (routeKey === '$disconnect') await relay.disconnect(connectionId);
    else if (routeKey !== '$connect') await relay.message(connectionId, event.body ?? '');
  } catch (err) {
    console.error(`${routeKey}: ${err.name}: ${err.message}`);
  }
  return { statusCode: 200 };
}
