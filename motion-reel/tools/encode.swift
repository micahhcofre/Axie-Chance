// El codificador del reel, con AVFoundation (la máquina no tiene ffmpeg y no hace falta).
//
//   encode video <out.mp4> <ancho> <alto> <fps> <mbps>
//       Lee cuadros crudos BGRA de arriba hacia abajo por stdin (ancho*alto*4 bytes cada
//       uno) y los escribe en H.264 High con VideoToolbox, etiquetados BT.709.
//   encode mux <video.mp4> <audio.m4a> <out.mp4>
//       Junta el video con el audio sin volver a codificar ninguno de los dos.
import AVFoundation
import CoreVideo
import Foundation

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("uso: encode video|mux ...") }

func encodeVideo(out: URL, width w: Int, height h: Int, fps: Int32, mbps: Double) {
  try? FileManager.default.removeItem(at: out)
  guard let writer = try? AVAssetWriter(outputURL: out, fileType: .mp4) else { fail("no se pudo abrir \(out.path)") }
  let props: [String: Any] = [
    AVVideoAverageBitRateKey: Int(mbps * 1_000_000),
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps),
    AVVideoExpectedSourceFrameRateKey: Int(fps),
    AVVideoAllowFrameReorderingKey: true,
    AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
  ]
  let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: w,
    AVVideoHeightKey: h,
    AVVideoCompressionPropertiesKey: props,
    AVVideoColorPropertiesKey: [
      AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
      AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
      AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
  ]
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
  input.expectsMediaDataInRealTime = false
  let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: w,
      kCVPixelBufferHeightKey as String: h,
    ])
  writer.add(input)
  guard writer.startWriting() else { fail("startWriting: \(String(describing: writer.error))") }
  writer.startSession(atSourceTime: .zero)

  let frameBytes = w * h * 4
  let stdin = FileHandle.standardInput
  var frame = Data(count: frameBytes)
  var count: Int64 = 0
  while true {
    var filled = 0
    while filled < frameBytes {
      let chunk = stdin.readData(ofLength: frameBytes - filled)
      if chunk.isEmpty { break }
      frame.replaceSubrange(filled..<(filled + chunk.count), with: chunk)
      filled += chunk.count
    }
    if filled < frameBytes { break }
    while !input.isReadyForMoreMediaData { usleep(1000) }
    guard let pool = adaptor.pixelBufferPool else { fail("sin pool de cuadros") }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    guard let pb = buffer else { fail("sin cuadro") }
    CVPixelBufferLockBaseAddress(pb, [])
    let dst = CVPixelBufferGetBaseAddress(pb)!
    let stride = CVPixelBufferGetBytesPerRow(pb)
    frame.withUnsafeBytes { raw in
      let src = raw.baseAddress!
      for y in 0..<h { memcpy(dst + y * stride, src + y * w * 4, w * 4) }
    }
    CVPixelBufferUnlockBaseAddress(pb, [])
    if !adaptor.append(pb, withPresentationTime: CMTime(value: count, timescale: fps)) {
      fail("append \(count): \(String(describing: writer.error))")
    }
    count += 1
  }
  input.markAsFinished()
  let done = DispatchSemaphore(value: 0)
  writer.finishWriting { done.signal() }
  done.wait()
  guard writer.status == .completed else { fail("finishWriting: \(String(describing: writer.error))") }
  print("video: \(count) cuadros")
}

func mux(video: URL, audio: URL, out: URL) {
  try? FileManager.default.removeItem(at: out)
  let v = AVURLAsset(url: video)
  let a = AVURLAsset(url: audio)
  let comp = AVMutableComposition()
  guard let vsrc = v.tracks(withMediaType: .video).first else { fail("el video no tiene pista") }
  guard let asrc = a.tracks(withMediaType: .audio).first else { fail("el audio no tiene pista") }
  let vt = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
  let at = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
  let span = CMTimeRange(start: .zero, duration: v.duration)
  do {
    try vt.insertTimeRange(span, of: vsrc, at: .zero)
    let audioSpan = CMTimeRange(start: .zero, duration: CMTimeMinimum(a.duration, v.duration))
    try at.insertTimeRange(audioSpan, of: asrc, at: .zero)
  } catch { fail("composición: \(error)") }
  vt.preferredTransform = vsrc.preferredTransform
  guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else { fail("sin export") }
  export.outputURL = out
  export.outputFileType = .mp4
  export.shouldOptimizeForNetworkUse = true
  let done = DispatchSemaphore(value: 0)
  export.exportAsynchronously { done.signal() }
  done.wait()
  guard export.status == .completed else { fail("export: \(String(describing: export.error))") }
  print("mux: \(out.path)")
}

switch args[1] {
case "video":
  guard args.count >= 7 else { fail("encode video <out> <w> <h> <fps> <mbps>") }
  encodeVideo(out: URL(fileURLWithPath: args[2]), width: Int(args[3])!, height: Int(args[4])!,
              fps: Int32(args[5])!, mbps: Double(args[6])!)
case "mux":
  guard args.count >= 5 else { fail("encode mux <video> <audio> <out>") }
  mux(video: URL(fileURLWithPath: args[2]), audio: URL(fileURLWithPath: args[3]), out: URL(fileURLWithPath: args[4]))
default:
  fail("modo desconocido: \(args[1])")
}
