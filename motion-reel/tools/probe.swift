// Mira un MP4 por dentro: duración, pistas, códec, cuadros por segundo y bitrate; y si se
// le pasan tiempos, saca esos cuadros del archivo ya codificado (lo que va a ver la gente,
// no lo que dibujó el navegador).
//
//   probe <video.mp4> [t1,t2,...] [carpeta]
import AVFoundation
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 2 else {
  FileHandle.standardError.write("uso: probe <video.mp4> [t1,t2,...] [carpeta]\n".data(using: .utf8)!)
  exit(1)
}
let url = URL(fileURLWithPath: args[1])
let asset = AVURLAsset(url: url)
print(String(format: "duración %.3f s", CMTimeGetSeconds(asset.duration)))
for track in asset.tracks {
  let fourcc = CMFormatDescriptionGetMediaSubType(track.formatDescriptions.first as! CMFormatDescription)
  let code = String(bytes: [24, 16, 8, 0].map { UInt8((fourcc >> UInt32($0)) & 0xff) }, encoding: .ascii) ?? "?"
  if track.mediaType == .video {
    print(String(format: "video %@ %.0fx%.0f %.2f fps %.1f Mbps", code, track.naturalSize.width, track.naturalSize.height,
                 track.nominalFrameRate, track.estimatedDataRate / 1_000_000))
  } else if track.mediaType == .audio {
    let desc = track.formatDescriptions.first as! CMAudioFormatDescription
    let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(desc)!.pointee
    print(String(format: "audio %@ %.0f Hz %d canales %.0f kbps, desde %.3f s", code, asbd.mSampleRate, asbd.mChannelsPerFrame,
                 track.estimatedDataRate / 1000, CMTimeGetSeconds(track.timeRange.start)))
  }
}
if args.count >= 3 {
  let dir = URL(fileURLWithPath: args.count >= 4 ? args[3] : FileManager.default.currentDirectoryPath)
  try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let gen = AVAssetImageGenerator(asset: asset)
  gen.appliesPreferredTrackTransform = true
  gen.requestedTimeToleranceBefore = .zero
  gen.requestedTimeToleranceAfter = .zero
  for s in args[2].split(separator: ",") {
    guard let t = Double(s) else { continue }
    do {
      let img = try gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)
      let out = dir.appendingPathComponent(String(format: "mp4-%05.2f.png", t))
      let dest = CGImageDestinationCreateWithURL(out as CFURL, "public.png" as CFString, 1, nil)!
      CGImageDestinationAddImage(dest, img, nil)
      CGImageDestinationFinalize(dest)
      print(out.path)
    } catch {
      print("no se pudo sacar el cuadro \(t): \(error)")
    }
  }
}
