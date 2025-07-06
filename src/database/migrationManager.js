const fs = require('fs').promises;
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

class MigrationManager {
  constructor() {
    this.migrationDir = path.join(__dirname, 'migrations');
    this.migrationsTable = 'migrations';
  }

  async initialize() {
    await this.createMigrationsTable();
  }

  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration VARCHAR(255) NOT NULL UNIQUE,
        batch INT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    try {
      await db.query(sql);
      logger.info('Migrations table created or already exists');
    } catch (error) {
      logger.error('Failed to create migrations table:', error);
      throw error;
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationDir);
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

  async getExecutedMigrations() {
    try {
      const results = await db.query(
        `SELECT migration FROM ${this.migrationsTable} ORDER BY id ASC`
      );
      return results.map(row => row.migration);
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      throw error;
    }
  }

  async getPendingMigrations() {
    const migrationFiles = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    
    return migrationFiles.filter(file => !executedMigrations.includes(file));
  }

  async getNextBatch() {
    try {
      const results = await db.query(
        `SELECT MAX(batch) as max_batch FROM ${this.migrationsTable}`
      );
      const maxBatch = results[0]?.max_batch || 0;
      return maxBatch + 1;
    } catch (error) {
      logger.error('Failed to get next batch number:', error);
      throw error;
    }
  }

  async runMigration(migrationFile) {
    const migrationPath = path.join(this.migrationDir, migrationFile);
    
    try {
      const migration = require(migrationPath);
      
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${migrationFile} does not export an 'up' function`);
      }

      logger.info(`Running migration: ${migrationFile}`);
      await migration.up(db);
      
      const batch = await this.getNextBatch();
      await db.query(
        `INSERT INTO ${this.migrationsTable} (migration, batch) VALUES (?, ?)`,
        [migrationFile, batch]
      );
      
      logger.info(`Migration completed: ${migrationFile}`);
      return true;
    } catch (error) {
      logger.error(`Migration failed: ${migrationFile}`, error);
      throw error;
    }
  }

  async rollbackMigration(migrationFile) {
    const migrationPath = path.join(this.migrationDir, migrationFile);
    
    try {
      const migration = require(migrationPath);
      
      if (typeof migration.down !== 'function') {
        throw new Error(`Migration ${migrationFile} does not export a 'down' function`);
      }

      logger.info(`Rolling back migration: ${migrationFile}`);
      await migration.down(db);
      
      await db.query(
        `DELETE FROM ${this.migrationsTable} WHERE migration = ?`,
        [migrationFile]
      );
      
      logger.info(`Migration rolled back: ${migrationFile}`);
      return true;
    } catch (error) {
      logger.error(`Migration rollback failed: ${migrationFile}`, error);
      throw error;
    }
  }

  async runPendingMigrations() {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to run');
      return [];
    }

    logger.info(`Running ${pendingMigrations.length} pending migrations`);
    const results = [];

    for (const migration of pendingMigrations) {
      try {
        await this.runMigration(migration);
        results.push({ migration, status: 'success' });
      } catch (error) {
        results.push({ migration, status: 'failed', error: error.message });
        break;
      }
    }

    return results;
  }

  async rollbackLastBatch() {
    try {
      const results = await db.query(
        `SELECT migration FROM ${this.migrationsTable} WHERE batch = (SELECT MAX(batch) FROM ${this.migrationsTable}) ORDER BY id DESC`
      );

      if (results.length === 0) {
        logger.info('No migrations to rollback');
        return [];
      }

      const rollbackResults = [];
      
      for (const row of results) {
        try {
          await this.rollbackMigration(row.migration);
          rollbackResults.push({ migration: row.migration, status: 'success' });
        } catch (error) {
          rollbackResults.push({ migration: row.migration, status: 'failed', error: error.message });
          break;
        }
      }

      return rollbackResults;
    } catch (error) {
      logger.error('Failed to rollback last batch:', error);
      throw error;
    }
  }

  async getMigrationStatus() {
    const migrationFiles = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    
    return migrationFiles.map(file => ({
      migration: file,
      status: executedMigrations.includes(file) ? 'executed' : 'pending'
    }));
  }

  async freshMigrations() {
    try {
      logger.info('Dropping all tables and running fresh migrations...');
      
      const tables = await db.query('SHOW TABLES');
      const tableNames = tables.map(row => Object.values(row)[0]);
      
      if (tableNames.length > 0) {
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of tableNames) {
          await db.query(`DROP TABLE IF EXISTS \`${table}\``);
        }
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
      }

      await this.createMigrationsTable();
      return await this.runPendingMigrations();
    } catch (error) {
      logger.error('Failed to run fresh migrations:', error);
      throw error;
    }
  }

  async createMigrationFile(name) {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
    const filename = `${timestamp}_${name}.js`;
    const filepath = path.join(this.migrationDir, filename);
    
    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

const up = async (db) => {
  // Write your migration logic here
  // Example:
  // await db.query(\`
  //   CREATE TABLE example_table (
  //     id INT AUTO_INCREMENT PRIMARY KEY,
  //     name VARCHAR(255) NOT NULL,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  //   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  // \`);
};

const down = async (db) => {
  // Write your rollback logic here
  // Example:
  // await db.query('DROP TABLE IF EXISTS example_table');
};

module.exports = { up, down };
`;

    try {
      await fs.mkdir(this.migrationDir, { recursive: true });
      await fs.writeFile(filepath, template);
      logger.info(`Migration file created: ${filename}`);
      return filename;
    } catch (error) {
      logger.error('Failed to create migration file:', error);
      throw error;
    }
  }
}

module.exports = new MigrationManager();