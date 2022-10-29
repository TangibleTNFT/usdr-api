class Cache {
  static create() {
    return new Cache();
  }

  async get(key, builder, expiresInSeconds) {
    const timestamp = new Date().getTime();
    console.log(this)
    if (this[key]) {
      if (timestamp < this[key].expires) {
        return this[key].value;
      }
    }
    const value = await builder();
    this[key] = {
      expires: timestamp + expiresInSeconds * 1000,
      value
    }
    return value;
  }
}

module.exports = Cache;