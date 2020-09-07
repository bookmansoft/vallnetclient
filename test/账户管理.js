/**
 * 单元测试：账户管理
 * Creted by liub 2020.07.01
 * @description
 * 在多用户模式下，全节点借助账户管理实现多用户管理功能
 * 在单用户模式下，全节点通过账户管理，实现业务账户管理功能
 * 关于多用户、单用户模式，详见'用户管理'相关说明
 */

const uuidv1 = require('uuid/v1');
const assert = require('assert');
const remote = (require('./util/connector'))();

let env = {
	alice: {
        name: uuidv1(),
    },
};

describe('1. 账户管理', function() {
    after(()=>{
        remote.close();
    });

    before(async () => {
        await remote.execute('miner.setsync.admin', [true]);
        let ret = await remote.execute('block.tips', []);
        if(ret[0].height < 100) {
            await remote.execute('miner.generate.admin', [100 - ret[0].height]);
        }
        await remote.wait(500);
    });

    it('1.1 创建账户: 创建一个新账户', async () => {
        let ret = await remote.execute('account.create', [{name: env.alice.name}]);
        assert(!ret.error);
        assert(ret.name == env.alice.name);
    });

    it('1.2 查询账户', async () => {
        let ret = await remote.execute('account.get', [env.alice.name]);
        assert(!ret.error);
        assert(ret.name == env.alice.name);
    });

    it('1.3 列表账户', async () => {
        let ret = await remote.execute('account.list', []);
        assert(!ret.error);
        assert(Object.keys(ret).indexOf(env.alice.name) != -1);
    });

    it('1.4 查询账户余额', async () => {
        let ret = await remote.execute('balance.confirmed', [env.alice.name]);
        assert(!ret.error);

        ret = await remote.execute('balance.unconfirmed', [env.alice.name]);
        assert(!ret.error);

        ret = await remote.execute('balance.all', [env.alice.name]);
        assert(!ret.error);
    });

    it('1.5 列表收款记录', async () => {
        let ret = await remote.execute('account.listreceived', []);
        assert(!ret.error);
    });

    it('1.6 查询收款总额', async () => {
        let ret = await remote.execute('account.received', [env.alice.name]);
        assert(!ret.error);
    });

    it('1.7 查询日志', async () => {
        let ret = await remote.execute('balance.log', [env.alice.name]);
        assert(!ret.error);
    });
});
