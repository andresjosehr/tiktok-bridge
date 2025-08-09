const fs = require('fs').promises;
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

class SeederManager {
  constructor() {
    this.seederDir = path.join(__dirname, 'seeders');
    this.seedersTable = 'seeders';
  }

  async initialize() {
    await this.createSeedersTable();
  }

  async createSeedersTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.seedersTable} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seeder VARCHAR(255) NOT NULL UNIQUE,
        batch INT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    try {
      await db.query(sql);
      logger.info('Seeders table created or already exists');
    } catch (error) {
      logger.error('Failed to create seeders table:', error);
      throw error;
    }
  }

  async getSeederFiles() {
    try {
      const files = await fs.readdir(this.seederDir);
      return files
        .filter(file => file.endsWith('.js'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getExecutedSeeders() {
    try {
      const results = await db.query(
        `SELECT seeder FROM ${this.seedersTable} ORDER BY id ASC`
      );
      return results.map(row => row.seeder);
    } catch (error) {
      logger.error('Failed to get executed seeders:', error);
      throw error;
    }
  }

  async getPendingSeeders() {
    const seederFiles = await this.getSeederFiles();
    const executedSeeders = await this.getExecutedSeeders();
    
    return seederFiles.filter(file => !executedSeeders.includes(file));
  }

  async getNextBatch() {
    try {
      const results = await db.query(
        `SELECT MAX(batch) as max_batch FROM ${this.seedersTable}`
      );
      const maxBatch = results[0]?.max_batch || 0;
      return maxBatch + 1;
    } catch (error) {
      logger.error('Failed to get next batch number:', error);
      throw error;
    }
  }

  async runSeeder(seederFile) {
    const seederPath = path.join(this.seederDir, seederFile);
    
    try {
      // Clear require cache to ensure fresh execution
      delete require.cache[require.resolve(seederPath)];
      const seeder = require(seederPath);
      
      if (typeof seeder.up !== 'function') {
        throw new Error(`Seeder ${seederFile} does not export an 'up' function`);
      }

      logger.info(`Running seeder: ${seederFile}`);
      await seeder.up(db);
      
      const batch = await this.getNextBatch();
      await db.query(
        `INSERT INTO ${this.seedersTable} (seeder, batch) VALUES (?, ?)`,
        [seederFile, batch]
      );
      
      logger.info(`Seeder completed: ${seederFile}`);
      return true;
    } catch (error) {
      logger.error(`Seeder failed: ${seederFile}`, error);
      throw error;
    }
  }

  async rollbackSeeder(seederFile) {
    const seederPath = path.join(this.seederDir, seederFile);
    
    try {
      // Clear require cache to ensure fresh execution
      delete require.cache[require.resolve(seederPath)];
      const seeder = require(seederPath);
      
      if (typeof seeder.down !== 'function') {
        throw new Error(`Seeder ${seederFile} does not export a 'down' function`);
      }

      logger.info(`Rolling back seeder: ${seederFile}`);
      await seeder.down(db);
      
      await db.query(
        `DELETE FROM ${this.seedersTable} WHERE seeder = ?`,
        [seederFile]
      );
      
      logger.info(`Seeder rolled back: ${seederFile}`);
      return true;
    } catch (error) {
      logger.error(`Seeder rollback failed: ${seederFile}`, error);
      throw error;
    }
  }

  async runPendingSeeders() {
    const pendingSeeders = await this.getPendingSeeders();
    
    if (pendingSeeders.length === 0) {
      logger.info('No pending seeders to run');
      return [];
    }

    logger.info(`Running ${pendingSeeders.length} pending seeders`);
    const results = [];

    for (const seeder of pendingSeeders) {
      try {
        await this.runSeeder(seeder);
        results.push({ seeder, status: 'success' });
      } catch (error) {
        results.push({ seeder, status: 'failed', error: error.message });
        break;
      }
    }

    return results;
  }

  async runAllSeeders() {
    const seederFiles = await this.getSeederFiles();
    
    if (seederFiles.length === 0) {
      logger.info('No seeders found to run');
      return [];
    }

    logger.info(`Running all ${seederFiles.length} seeders`);
    const results = [];

    // Clear all executed seeders first
    await db.query(`DELETE FROM ${this.seedersTable}`);

    for (const seeder of seederFiles) {
      try {
        await this.runSeeder(seeder);
        results.push({ seeder, status: 'success' });
      } catch (error) {
        results.push({ seeder, status: 'failed', error: error.message });
        break;
      }
    }

    return results;
  }

  async rollbackLastBatch() {
    try {
      const results = await db.query(
        `SELECT seeder FROM ${this.seedersTable} WHERE batch = (SELECT MAX(batch) FROM ${this.seedersTable}) ORDER BY id DESC`
      );

      if (results.length === 0) {
        logger.info('No seeders to rollback');
        return [];
      }

      const rollbackResults = [];
      
      for (const row of results) {
        try {
          await this.rollbackSeeder(row.seeder);
          rollbackResults.push({ seeder: row.seeder, status: 'success' });
        } catch (error) {
          rollbackResults.push({ seeder: row.seeder, status: 'failed', error: error.message });
          break;
        }
      }

      return rollbackResults;
    } catch (error) {
      logger.error('Failed to rollback last batch:', error);
      throw error;
    }
  }

  async rollbackAllSeeders() {
    try {
      const results = await db.query(
        `SELECT seeder FROM ${this.seedersTable} ORDER BY id DESC`
      );

      if (results.length === 0) {
        logger.info('No seeders to rollback');
        return [];
      }

      const rollbackResults = [];
      
      for (const row of results) {
        try {
          await this.rollbackSeeder(row.seeder);
          rollbackResults.push({ seeder: row.seeder, status: 'success' });
        } catch (error) {
          rollbackResults.push({ seeder: row.seeder, status: 'failed', error: error.message });
          break;
        }
      }

      return rollbackResults;
    } catch (error) {
      logger.error('Failed to rollback all seeders:', error);
      throw error;
    }
  }

  async getSeederStatus() {
    const seederFiles = await this.getSeederFiles();
    const executedSeeders = await this.getExecutedSeeders();
    
    return seederFiles.map(file => ({
      seeder: file,
      status: executedSeeders.includes(file) ? 'executed' : 'pending'
    }));
  }

  async createSeederFile(name) {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
    const filename = `${timestamp}_${name}.js`;
    const filepath = path.join(this.seederDir, filename);
    
    const template = `/**
 * Seeder: ${name}
 * Created: ${new Date().toISOString()}
 */

const up = async (db) => {
  // Write your seeder logic here
  // Example:
  // await db.query(\`
  //   INSERT INTO users (name, email, created_at, updated_at) VALUES
  //   ('John Doe', 'john@example.com', NOW(), NOW()),
  //   ('Jane Smith', 'jane@example.com', NOW(), NOW())
  // \`);
};

const down = async (db) => {
  // Write your rollback logic here
  // Example:
  // await db.query('DELETE FROM users WHERE email IN ("john@example.com", "jane@example.com")');
};

module.exports = { up, down };
`;

    try {
      await fs.mkdir(this.seederDir, { recursive: true });
      await fs.writeFile(filepath, template);
      logger.info(`Seeder file created: ${filename}`);
      return filename;
    } catch (error) {
      logger.error('Failed to create seeder file:', error);
      throw error;
    }
  }
}

module.exports = new SeederManager();