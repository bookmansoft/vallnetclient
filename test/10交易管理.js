/**
 * 联机单元测试：基础转账功能
 * @description
 */

const assert = require('assert')
const connector = require('./util/connector');
const remote = connector({structured: true});

let env = {};

describe('10. 交易管理', () => {
    after(()=>{
        remote.close();
    });

    before(async () => {
        //强制设置同步完成标志
        await remote.execute('miner.setsync.admin', [true]);
        //检测块高度，必要时进行挖矿以确保创世区块成熟
        let ret = await remote.execute('block.tips', []);
        if(ret.result[0].height < 100) {
            await remote.execute('miner.generate.admin', [100 - ret.result[0].height]);
        }

        ret = await remote.execute('address.create', []);
        assert(!ret.error);
        env.address = ret.result.address;
        env.amount = 100000000;

        console.log(`[模拟输入数据开始]`);
        console.log(`- 随机地址: ${env.address}`);
        console.log(`- 随机金额: ${env.amount}`);
        console.log(`[模拟输入数据结束]`);
    });

    it('10.1 发送交易', async () => {
        let ret = await remote.execute('tx.send', [env.address, env.amount]);
        assert(!ret.error);
        env.hash = ret.result.hash;
        console.log(`提交地址和金额，发送交易至指定地址，返回码: ${ret.error?-1:0}, 交易哈希: ${env.hash}`);
    });

    it('10.2 按哈希查询交易', async () => {
        let ret = await remote.execute('tx.get', [env.hash]);
        assert(!ret.error);
        assert(env.hash == ret.result.hash);
        console.log(`查询指定哈希${env.hash}对应的交易记录，返回码: ${ret.error?-1:0}, 交易原始数据: ${ret.result.hex}`);
    });

    it('10.3 按地址查询交易', async () => {
        let ret = await remote.execute('tx.list.address', [env.address]);
        assert(!ret.error);
        console.log(`查询指定地址${env.address}下的交易列表，返回码: ${ret.error?-1:0}, 交易列表:`);
        console.log(ret.result);
    });

    it('10.4 查询历史交易', async () => {
        let ret = await remote.execute('tx.list', [null, 2]);
        assert(!ret.error);
        console.log(`查询历史交易列表(指定最大返回记录数:2)，返回码: ${ret.error?-1:0}, 历史交易列表:`);
        console.log(ret.result);
    });
});
