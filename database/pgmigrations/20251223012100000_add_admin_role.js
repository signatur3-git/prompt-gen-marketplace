exports.shorthands = undefined;

exports.up = (_pgm) => {
  // No-op.
  // The baseline migration (0001) already includes users.is_admin.
  // This migration exists only to preserve the historical record.
};

exports.down = (_pgm) => {
  // No-op.
};
