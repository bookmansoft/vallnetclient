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
const remote = (require('./util/connector'))({structured: true});

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
        if(ret.result[0].height < 100) {
            await remote.execute('miner.generate.admin', [100 - ret.result[0].height]);
        }
        await remote.wait(500);

        console.log(`[模拟输入数据开始]`);
        console.log(`- 账户名称: ${env.alice.name}`);
        console.log(`[模拟输入数据结束]`);
    });

    it('1.1 创建账户', async () => {
        let ret = await remote.execute('account.create', [{name: env.alice.name}]);
        assert(!ret.error);
        assert(ret.result.name == env.alice.name);
        console.log(`提交一个账户名称(${env.alice.name})来创建一个新账户, 返回码: ${ret.code}`);
    });

    it('1.2 查询账户', async () => {
        let ret = await remote.execute('account.get', [env.alice.name]);
        assert(!ret.error);
        assert(ret.result.name == env.alice.name);
        console.log(`提交一个账户名称(${env.alice.name})查询指定账户信息，返回码: ${ret.code}`);
    });

    it('1.3 列表账户', async () => {
        let ret = await remote.execute('account.list', []);
        assert(!ret.error);
        let keys = Object.keys(ret.result);
        assert(keys.indexOf(env.alice.name) != -1);
        console.log(`列表当前钱包内所有账户，返回码: ${ret.code}, 账户列表:`);
        for(let key of keys) {
            console.log(`账户: ${key}, 余额: ${ret.result[key]*100000000}`);
        }
    });

    it('1.4 查询账户余额', async () => {
        let ret = await remote.execute('balance.all', [env.alice.name]);
        assert(!ret.error);
        console.log(`提交一个账户名称查询指定账户余额，返回码: ${ret.code}, 余额: ${ret.result.unconfirmed}`);
        await remote.execute('tx.create', [{"sendnow":true}, [{"value":500000000, "account": env.alice.name}]]);
        console.log(`为该账户转账500000000`);

        ret = await remote.execute('balance.all', [env.alice.name]);
        assert(!ret.error);
        console.log(`再次查询该账户余额，返回码: ${ret.code}, 余额: ${ret.result.unconfirmed}`);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('1.5 列表收款记录', async () => {
        let ret = await remote.execute('account.listreceived', []);
        assert(!ret.error);
        console.log(`按账户汇总显示账户收款额，返回码: ${ret.code}, 分账户收款记录列表:`);
        for(let item of ret.result) {
            console.log(`账户: ${item.account} 余额: ${item.amount*100000000}`);
        }
    });

    it('1.6 查询收款总额', async () => {
        let ret = await remote.execute('account.received', [env.alice.name]);
        assert(!ret.error);
        console.log(`提交一个账户名称${env.alice.name}查询指定账户收款总额，返回码: ${ret.code}, 收款总额: ${ret.result*100000000}`);
    });

    it('1.7 查询日志', async () => {
        let ret = await remote.execute('balance.log', [env.alice.name]);
        assert(!ret.error);
        console.log(`提交一个账户名称${env.alice.name}查询指定账户变更日志，返回码: ${ret.code}，日志:`);
        console.log(JSON.stringify(ret.result));
    });
});
