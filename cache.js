class Cache {
  static create() {
    return new Cache();
  }

  async get(key, builder, expiresInSeconds) {
    const timestamp = new Date().getTime();
    if (this[key]) {
      if (timestamp < this[key].expires) {
        return this[key].value;
      }
    }
    try {
      const value = await builder();
      this[key] = {
        expires: timestamp + expiresInSeconds * 1000,
        value
      }
      return value;
    } catch (err) {
      if (this[key]) return this[key].value;
      throw err;
    }
  }
}

module.exports = Cache;