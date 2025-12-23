exports.shorthands = undefined;

exports.up = (_pgm) => {
  // No-op.
  // Namespace length is not enforced at the DB level (column is TEXT).
  // The limit increase is implemented in application validation.
};

exports.down = (_pgm) => {
  // No-op.
};
