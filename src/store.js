const fs = require('node:fs');
const path = require('node:path');

const defaults = { accounts: [], selectedAccountId: null, instances: [] };

class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = structuredClone(defaults);
    this.load();
  }

  load() {
    try {
      this.data = { ...structuredClone(defaults), ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Could not read Packsmith data:', error.message);
    }
    return this.data;
  }

  save(next = this.data) {
    this.data = next;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2));
    fs.renameSync(temporary, this.file);
    return this.data;
  }
}

module.exports = { JsonStore, defaults };
