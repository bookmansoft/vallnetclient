/**
 * 单元测试：地址相关的RPC调用
 * Creted by liub 2018.9.11
 */

const assert = require('assert');
const remote = (require('./util/connector'))();

let env = {
    account: 'default',
};

describe('14. 地址管理', function() {
    after(()=>{
        remote.close();
    });

    before(()=>{
        console.log(`[模拟输入数据开始]`);
        console.log(`- 指定账户名称: ${env.account}`);
        console.log(`[模拟输入数据结束]`);
    });

    it('14.1 创建地址', async () => {
        let ret = await remote.execute('address.create', []);
        assert(!ret.error);
        console.log(`创建一个新地址, 返回码: ${ret.error?-1:0}, 地址: ${ret.address}`);
        env.address = ret.address;
    });

    it('14.2 查询余额', async () => {
        let ret = await remote.execute('getAddressSummary', [env.address]);
        assert(!ret.error);
        console.log(`获取指定地址${env.address}金额汇总信息, 返回码: ${ret.error?-1:0}, 查询结果: ${JSON.stringify(ret)}`);
    });

    it('14.3 查询账户地址', async () => {
        let ret = await remote.execute('address.receive', [env.account]);
        assert(!ret.error);
        console.log(`列表指定账户${env.account}下收款地址, 返回码: ${ret.error?-1:0}, 收款地址: ${ret}`);
    });

    it('14.4 查询概要', async () => {
        let ret = await remote.get(`addr/${env.address}`); 
        assert(!ret.error);
        env.balance = ret;
        console.log(`获取指定地址${env.address}的汇总信息, 返回码: ${ret.error?-1:0}, 查询结果: ${JSON.stringify(ret)}`);
    });

    it('14.5 查询进项', async () => {
        let ret = await remote.execute('address.received.list', []);
        assert(!ret.error);
        env.receivedList = ret;
        console.log(`按照地址列表进项总额, 返回码: ${ret.error?-1:0}`);
        if(ret.length > 0) {
            console.log('打印返回列表首条记录', JSON.stringify(ret[0]));
        }
    });

    it('14.6 查询进项总额', async () => {
        let ret = await remote.execute('address.received', [env.address]);
        assert(!ret.error);
        env.received = ret;
        console.log(`根据地址查询进项总额, 返回码: ${ret.error?-1:0}`);
    });

    it('14.7 查询归属账户', async () => {
        let ret = await remote.execute('address.account', [env.address]);
        assert(!ret.error);
        env.account = ret;
        console.log(`查询指定地址${env.address}对应的账户, 返回码: ${ret.error?-1:0}`);
    });
    
    // it('查询余额：获取指定地址金额汇总信息', async () => {
    //     let ret = await remote.execute('address.amount', [env.address]);
    //     assert(!ret.error   );
    //     env.amount = ret;
    // });

    it('14.8 查询订单', async () => {
        let ret = await remote.execute('address.filter', [null, null, null]);
        assert(!ret.error);
        console.log(`查询从订单中获取符合条件的地址集合, 返回码: ${ret.error?-1:0}`);
    });

    it('14.9 查询历史', async () => {
        let ret = await remote.execute('getAddressHistory', [[env.address]]);
        assert(!ret.error);
        console.log(`获取指定地址相关历史信息, 返回码: ${ret.error?-1:0}`);
    });

    it('14.10 查询通证', async () => {
        let ret = await remote.execute('getAddressUnspentOutputs', [env.address]);
        assert(!ret.error);
        console.log(`获取指定地址UTXO集合, 返回码: ${ret.error?-1:0}`);
    });

    it('14.11 查询交易', async () => {
        let ret = await remote.execute('getTxidsByAddress', [env.address, 'input']);
        assert(!ret.error);
        env.inputs = ret;
        console.log(`获取指定地址相关的交易ID列表, 返回码: ${ret.error?-1:0}`);
    });

    // it('查询交易：获取指定地址相关的交易列表', async () => {
    //     let ret = await remote.post('addrs/txs', {addr:env.address});
    //     assert(!ret.error);
    //     env.txs = ret;
    // });

    // it('查询通证：获取指定地址的UTXO', async () => {
    //     let ret = await remote.get(`addr/${env.address}/utxo`);
    //     assert(!ret.error);
    //     env.utxo = ret;
    // });
});