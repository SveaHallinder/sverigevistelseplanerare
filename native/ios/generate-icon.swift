import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Samma kalendergeometri och färger som repots befintliga favicon i index.html.
// App Store kräver en ikon utan alfakanal; systemet applicerar ikonens hörnmask.
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let assets = root.appendingPathComponent("Sverigevistelseplaneraren/Assets.xcassets", isDirectory: true)
let icons = assets.appendingPathComponent("AppIcon.appiconset", isDirectory: true)
try FileManager.default.createDirectory(at: icons, withIntermediateDirectories: true)

func renderIcon(_ size: Int) throws {
    guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                                  bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
        throw NSError(domain: "sverigevistelseplanerare.icon", code: 1)
    }
    context.setFillColor(CGColor(red: 29 / 255, green: 29 / 255, blue: 31 / 255, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: size, height: size))
    context.translateBy(x: 0, y: CGFloat(size))
    context.scaleBy(x: CGFloat(size) / 32, y: -CGFloat(size) / 32)
    func rectangle(_ rect: CGRect, radius: CGFloat, color: CGColor) {
        context.setFillColor(color)
        context.addPath(CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.fillPath()
    }
    rectangle(CGRect(x: 6, y: 9, width: 20, height: 17), radius: 4,
              color: CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    let blue = CGColor(red: 0, green: 122 / 255, blue: 1, alpha: 1)
    rectangle(CGRect(x: 6, y: 9, width: 20, height: 4), radius: 2, color: blue)
    rectangle(CGRect(x: 9, y: 17, width: 5, height: 5), radius: 1.5, color: blue)
    let output = icons.appendingPathComponent("AppIcon-" + String(size) + ".png")
    guard let image = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "sverigevistelseplanerare.icon", code: 2)
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "sverigevistelseplanerare.icon", code: 3)
    }
}

for size in [16, 32, 64, 128, 256, 512, 1024] { try renderIcon(size) }
let info: [String: Any] = ["author": "xcode", "version": 1]
var images: [[String: String]] = [[
    "filename": "AppIcon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"
]]
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        images.append([
            "filename": "AppIcon-" + String(size * scale) + ".png",
            "idiom": "mac", "size": String(size) + "x" + String(size), "scale": String(scale) + "x"
        ])
    }
}
let options: JSONSerialization.WritingOptions = [.prettyPrinted, .sortedKeys]
try JSONSerialization.data(withJSONObject: ["info": info], options: options)
    .write(to: assets.appendingPathComponent("Contents.json"), options: .atomic)
try JSONSerialization.data(withJSONObject: ["images": images, "info": info], options: options)
    .write(to: icons.appendingPathComponent("Contents.json"), options: .atomic)
