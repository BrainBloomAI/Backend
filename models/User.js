const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        }
    }, { tableName: 'users' });

    // Associations
    // User.associate = (models) => {
        
    // }

    // User.hook = (models) => {
        
    // }

    return User;
}