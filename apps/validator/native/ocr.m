// Onafhankelijke OCR-laag via macOS Vision (geen keys, volledig on-device).
//
// Geschreven in Objective-C i.p.v. Swift: de meegeleverde Command Line Tools
// hebben een kapotte Swift-toolchain (compiler/SDK swiftmodule-versie mismatch),
// maar clang compileert Objective-C rechtstreeks tegen de framework-headers en
// omzeilt dat probleem volledig. Vision is hetzelfde framework — een andere
// perceptie-technologie dan het LLM dat de trainer-content extraheerde, dus
// een écht onafhankelijke waarnemer voor de coverage-check.
//
// Compile: clang -framework Foundation -framework Vision -framework AppKit \
//            -fobjc-arc -o ocr ocr.m
// Gebruik: ./ocr <image-pad>
// Output: JSON { "lines": ["...", ...] } op stdout.

#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <AppKit/AppKit.h>

static void fail(NSString *msg) {
    [[NSFileHandle fileHandleWithStandardError]
        writeData:[[msg stringByAppendingString:@"\n"] dataUsingEncoding:NSUTF8StringEncoding]];
    exit(1);
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) fail(@"Gebruik: ocr <image-pad>");
        NSString *pad = [NSString stringWithUTF8String:argv[1]];

        NSImage *image = [[NSImage alloc] initWithContentsOfFile:pad];
        if (!image) fail([@"Kan afbeelding niet laden: " stringByAppendingString:pad]);

        CGImageRef cgImage = [image CGImageForProposedRect:NULL context:nil hints:nil];
        if (!cgImage) fail(@"Kan geen CGImage maken uit afbeelding");

        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.usesLanguageCorrection = YES;
        request.recognitionLanguages = @[@"fr-FR", @"nl-NL", @"en-US"];

        VNImageRequestHandler *handler =
            [[VNImageRequestHandler alloc] initWithCGImage:cgImage options:@{}];

        NSError *error = nil;
        if (![handler performRequests:@[request] error:&error]) {
            fail([@"OCR mislukt: " stringByAppendingString:error.localizedDescription]);
        }

        NSMutableArray<NSString *> *lines = [NSMutableArray array];
        for (VNRecognizedTextObservation *obs in request.results) {
            VNRecognizedText *top = [[obs topCandidates:1] firstObject];
            if (top) {
                NSString *trimmed = [top.string
                    stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                if (trimmed.length > 0) [lines addObject:trimmed];
            }
        }

        NSData *json = [NSJSONSerialization dataWithJSONObject:@{@"lines": lines}
                                                       options:0
                                                         error:&error];
        if (!json) fail(@"JSON-serialisatie mislukt");
        [[NSFileHandle fileHandleWithStandardOutput] writeData:json];
    }
    return 0;
}
