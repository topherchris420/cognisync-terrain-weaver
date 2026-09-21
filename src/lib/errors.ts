export class GeoError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'GeoError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidCoordinateError extends GeoError {
  constructor(public lat: number, public lng: number) {
    super(`Invalid coordinates: lat=${lat}, lng=${lng}`, 'INVALID_COORD');
    this.name = 'InvalidCoordinateError';
  }
}

export class InvalidBoundingBoxError extends GeoError {
  constructor(message: string = 'Invalid bounding box coordinates') {
    super(message, 'INVALID_BBOX');
    this.name = 'InvalidBoundingBoxError';
  }
}
