import { describe, expect, it } from 'vitest';
import {
  base64ByteLength,
  compressImage,
  dataUrlToBlob,
  fitWithin,
  formatBytes,
  ImageProcessingError,
  MAX_ATTACHMENTS,
  MAX_DIMENSION,
  MAX_INPUT_BYTES,
  MAX_PUBLIC_ATTACHMENTS,
  MAX_STORED_BYTES,
  THUMB_DIMENSION,
  withExtension,
} from './images';

describe('constantes de imágenes', () => {
  it('respeta los límites acordados', () => {
    expect(MAX_INPUT_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_STORED_BYTES).toBe(600 * 1024);
    expect(MAX_DIMENSION).toBe(1600);
    expect(THUMB_DIMENSION).toBe(240);
    expect(MAX_ATTACHMENTS).toBe(6);
    expect(MAX_PUBLIC_ATTACHMENTS).toBe(3);
  });
});

describe('fitWithin', () => {
  it('no agranda imágenes más pequeñas que el máximo', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('escala proporcionalmente una imagen horizontal que supera el límite', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it('escala proporcionalmente una imagen vertical que supera el límite', () => {
    expect(fitWithin(1200, 2400, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it('garantiza dimensiones mínimas de 1 px', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 1, height: 1 });
  });
});

describe('base64ByteLength', () => {
  it('calcula los bytes binarios a partir de una data URL y de base64 puro', () => {
    // 4 chars base64 sin padding = 3 bytes ("abc" -> "YWJj")
    expect(base64ByteLength('YWJj')).toBe(3);
    expect(base64ByteLength('data:image/webp;base64,YWJj')).toBe(3);
    // 1 padding ('=') = 2 bytes ("ab" -> "YWI=")
    expect(base64ByteLength('YWI=')).toBe(2);
    // 2 padding ('==') = 1 byte ("a" -> "YQ==")
    expect(base64ByteLength('YQ==')).toBe(1);
  });
});

describe('formatBytes', () => {
  it('formatea en KB para tamaños menores a 1 MB', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(150 * 1024)).toBe('150 KB');
  });

  it('formatea en MB con coma decimal para tamaños mayores o iguales a 1 MB', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20,0 MB');
  });
});

describe('withExtension', () => {
  it('asigna la extensión según el mime', () => {
    expect(withExtension('captura.png', 'image/webp')).toBe('captura.webp');
    expect(withExtension('foto.jpeg', 'image/jpeg')).toBe('foto.jpg');
    expect(withExtension('icono', 'image/png')).toBe('icono.png');
  });

  it('usa "imagen" como base si el nombre viene vacío', () => {
    expect(withExtension('', 'image/webp')).toBe('imagen.webp');
    expect(withExtension('   ', 'image/jpeg')).toBe('imagen.jpg');
  });

  it('trunca nombres excesivamente largos a 80 caracteres de base', () => {
    const longName = 'a'.repeat(120);
    const result = withExtension(longName, 'image/webp');
    expect(result).toBe(`${'a'.repeat(80)}.webp`);
  });
});

describe('dataUrlToBlob', () => {
  it('reconstruye un Blob con el tipo MIME y los bytes correctos', async () => {
    const dataUrl = 'data:image/webp;base64,YWJj'; // "abc"
    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBe(3);
    const text = await blob.text();
    expect(text).toBe('abc');
  });
});

describe('compressImage validaciones previas', () => {
  it('rechaza archivos que no son imágenes', async () => {
    const file = new Blob(['texto plano'], { type: 'text/plain' });
    await expect(compressImage(file)).rejects.toThrow(ImageProcessingError);
    await expect(compressImage(file)).rejects.toThrow('Solo se pueden adjuntar imágenes.');
  });

  it('rechaza archivos que superan el tamaño máximo original de 25 MB', async () => {
    // Creamos un Blob mockeando su propiedad size
    const hugeBlob = new Blob([], { type: 'image/jpeg' });
    Object.defineProperty(hugeBlob, 'size', { value: 26 * 1024 * 1024 });
    await expect(compressImage(hugeBlob)).rejects.toThrow(ImageProcessingError);
    await expect(compressImage(hugeBlob)).rejects.toThrow(/el máximo es 25,0 MB/);
  });
});
