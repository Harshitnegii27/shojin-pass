// Error codes shown to the app (spec 13.2). Messages are fixed; details never include secrets.

export const ERRORS = {
  INVALID_REQUEST: { status: 400, message: 'Something in the request wasn’t right.' },
  UNAUTHENTICATED: { status: 401, message: 'Please reopen the app.' },
  FORBIDDEN: { status: 403, message: 'You don’t have access to this.' },
  NOT_FOUND: { status: 404, message: 'We couldn’t find that.' },
  IMAGE_TOO_LARGE: { status: 413, message: 'Photo must be under 4 MB.' },
  UNSUPPORTED_IMAGE: { status: 415, message: 'Please use a JPEG, PNG, WebP or HEIC photo.' },
  IMAGE_TOO_SMALL: { status: 422, message: 'The photo is too small to read. Move closer.' },
  RATE_LIMITED: { status: 429, message: 'Slow down a little — try again in a minute.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong on our side.' },
};

export class AppError extends Error {
  constructor(code, details) {
    super(code);
    this.code = ERRORS[code] ? code : 'INTERNAL_ERROR';
    this.details = details;
  }
}
