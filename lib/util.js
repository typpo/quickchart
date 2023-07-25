function fixNodeVmObject(obj) {
  // Fix for https://github.com/patriksimek/vm2/issues/198
  if (!obj) return;

  const objKeys = Object.keys(obj);
  for (let i = 0; i < objKeys.length; i++) {
    const key = objKeys[i];
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

module.exports = {
  fixNodeVmObject,
};
