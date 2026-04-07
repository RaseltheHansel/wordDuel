import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class User extends Model {
    declare id: number;
    declare username: string;
    declare email: string;
    declare password: string;
    declare wins: number;
    declare losses: number
    declare totalGames: number;
}

User.init({
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    username: {type: DataTypes.STRING, allowNull: false, unique: true},
    email: {type: DataTypes.STRING, allowNull: false, unique: true},
    password: {type: DataTypes.STRING, allowNull: false},
    wins: {type: DataTypes.INTEGER, defaultValue: 0},
    losses: {type: DataTypes.INTEGER, defaultValue: 0},
    totalGames: {type: DataTypes.INTEGER, defaultValue: 0}
}, {
    sequelize,
    tableName: 'users',
    timestamps: true
});

export default User;