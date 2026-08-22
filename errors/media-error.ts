import { AppError } from './app-error';

export class PayloadTooLargeError extends AppError {
	public constructor(message = 'El archivo supera el tamaño permitido.') {
		super(message, 413, 'PAYLOAD_TOO_LARGE');
	}
}

export class UnsupportedMediaTypeError extends AppError {
	public constructor(message = 'El formato del archivo no está permitido.') {
		super(message, 415, 'UNSUPPORTED_MEDIA_TYPE');
	}
}
