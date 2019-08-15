function fixNodeVmObject(obj) {
  // Fix for https://github.com/patriksimek/vm2/issues/198
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const val = obj[key];
      if (Array.isArray(val)) {
        obj[key] = Array.from(val);
        obj[key].forEach(arrObj => {
          fixNodeVmObject(arrObj);
        });
      } else if (typeof val === 'object' && val !== null) {
        fixNodeVmObject(val);
      }
    }
  }
}

module.exports = {
  fixNodeVmObject,
};
