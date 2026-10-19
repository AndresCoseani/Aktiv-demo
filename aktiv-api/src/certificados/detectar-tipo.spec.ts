import { detectarTipo } from "./tipo-archivo";

describe("detectarTipo (firma del archivo, no su extensión)", () => {
  it("reconoce PDF, JPEG, PNG y WebP", () => {
    expect(detectarTipo(Buffer.from("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe("image/jpeg");
    expect(detectarTipo(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe("image/png");
    expect(detectarTipo(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]))).toBe("image/webp");
  });

  it("rechaza ejecutables, texto, HTML, SVG y archivos vacíos", () => {
    expect(detectarTipo(Buffer.from("MZ\x90\x00"))).toBeNull(); // .exe
    expect(detectarTipo(Buffer.from("hola, esto es texto"))).toBeNull();
    expect(detectarTipo(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectarTipo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectarTipo(Buffer.alloc(0))).toBeNull();
  });

  it("un PDF tiene que EMPEZAR con la firma (no vale esconderlo adentro)", () => {
    expect(detectarTipo(Buffer.from("basura%PDF-1.4"))).toBeNull();
  });

  it("RIFF que no es WebP (por ejemplo un .wav) se rechaza", () => {
    expect(detectarTipo(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt ")]))).toBeNull();
  });
});
