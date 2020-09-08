/**
 * 单元测试: 节点管理
 * @description 
 * 1. 本单元测试采用子进程模式调度节点自动运行，不需事先运行外部节点
 * 2. 可以任意指定合法网络类型、端口偏移量，进行节点部署
 */

const assert = require('assert')
const connector = require('./util/connector');
const common = require('./util/common');

const exec = require('child_process').exec; 
let child = null;
let env = {
    network: 'htlc',        //链类型
    netport: 2402,          //链类型对应RPC默认端口
    offset: 0,              //端口偏移量设置
}

const remote = connector({
    ip: common.testhost,
    type: env.network, 
    port: env.netport + env.offset
});

describe('9. 节点管理', () => {
    after(()=>{
        //退出节点运行
        if(child) {
            child.kill('SIGTERM');
        }

        remote.close();
    });

    it('9.1 节点运行', async () => {
        child = exec(`node index.js --genesis --port-offset=${env.offset} --network=${env.network}`, function(err, stdout, stderr) {
            if(err) {
                console.log(stderr);
            } else {
                // var data = JSON.parse(stdout);
                // console.log(data);
                console.log(`调度子进程运行节点, 返回码: ${err?-1:0}`);
            }
        });

        child.once('exit', () => {
            //console.log('node exit.');
        });

        await remote.wait(3000);
    });

    it('9.2 自动记账', async () => {
        let ret = await remote.execute('miner.set.admin', [true]);
        assert(!ret.error);
        console.log(`设置节点自动记账, 返回码: ${ret.error?-1:0}`);
    });

    it('9.3 手动记账：设置节点手动记账', async () => {
        let ret = await remote.execute('miner.set.admin', [false]);
        assert(!ret.error);
        console.log(`设置节点手动记账, 返回码: ${ret.error?-1:0}`);

        //设置一个等待时间
        await remote.wait(1000);

        ret = await remote.execute('block.tips', []);
        assert(!ret.error);
        env.height = parseInt(ret[0].height);

        ret = await remote.execute('miner.generate.admin', [1]);
        assert(!ret.error);
        env.blockid = common.revHex(ret[0]);
        await remote.wait(1000);

        ret = await remote.execute('block.tips', []);
        assert(!ret.error);
        assert(env.height == parseInt(ret[0].height) - 1);
    });

    it('9.4 查询记账设置', async () => {
        let ret = await remote.execute('miner.check', []);
        assert(!ret.error);
        assert(ret == false);
        console.log(`查询当前记账设置, 返回码: ${ret.error?-1:0}，当前状态: ${ret}`);
    });

    it('9.5 查询记账难度', async () => {
        let ret = await remote.execute('miner.difficulty', []);
        assert(!ret.error);
        console.log(`查询当前记账难度, 返回码: ${ret.error?-1:0}，当前难度: ${ret}`);
    });

    it('9.6 查询区块信息', async () => {
        let ret = await remote.get(`block/${env.blockid}`);
        assert(!ret.error);
        console.log(`提交区块编号查询指定区块信息, 返回码: ${ret.error?-1:0}`);
    });

    it('9.7 查询区块数据', async () => {
        let msg = await remote.execute('getRawBlock', [env.blockid]);
        assert(!msg.error);
        console.log(`提交区块编号查询区块原始信息, 返回码: ${msg.error?-1:0}`);
    });

    it('9.8 查询区块概要', async () => {
        let msg = await remote.execute('getBlockOverview', [env.blockid]);
        assert(!msg.error);
        console.log(`提交区块编号查询区块概要信息, 返回码: ${msg.error?-1:0}`);
    });

    it('9.9 查询区块列表', async () => {
        let msg = await remote.get('blocks');
        assert(!msg.error);
        console.log(`获取近期区块列表, 返回码: ${msg.error?-1:0}`);
    });

    it('9.10 查询同步', async () => {
        //设置长连模式
        remote.setmode(remote.CommMode.ws);

        let msg = await remote.execute('isSynced', []);
        assert(!msg.error);
        console.log(`获取同步状态, 返回码: ${msg.error?-1:0}，同步状态: ${msg}`);
    });

    it('9.11 查询系统概要', async () => {
        let msg = await remote.execute('sys.info', []);
        assert(!msg.error);
        console.log(`获取系统概要信息, 返回码: ${msg.error?-1:0}`);
    });

    // it('测试长连下异步回调应答是否匹配', async () => {
    //     try {
    //         await remote.execute('miner.setsync.admin', []);

    //         for(let i = 0; i < 10; i++) {
    //             let msg = await remote.execute('tx.list', []);
    //             assert(msg[0].account);

    //             msg = await remote.execute('balance.all', []);
    //             assert(msg.confirmed);
    //         }
    //     } catch(e) {
    //         console.log(e.message);
    //     }
    // });

    it('9.12 查询分叉', async () => {
        let ret = await remote.execute('block.tips', []);
        assert(!ret.error);
        console.log(`查询所有分叉的头部信息, 返回码: ${ret.error?-1:0}`);
    });

    it('9.13 重置区块', async () => {
        await remote.execute('miner.generate.admin', [1]);

        let ret = await remote.execute('block.reset.admin', [env.height]);
        assert(!ret.error);
        console.log(`提交一个高度值，重置区块头至该高度对应区块, 返回码: ${ret.error?-1:0}`);

        ret = await remote.execute('block.count', []);
        assert(!ret.error);
        assert(env.height == ret);
    });

    it('9.14 查询块链顶部', async () => {
        let ret = await remote.execute('block.best', []);
        assert(!ret.error);
        env.hash = ret;
        console.log(`获取当前主链顶部区块哈希, 返回码: ${ret.error?-1:0}，区块哈希: ${ret}`);
    });

    it('9.15 查询块链高度', async () => {
        let ret = await remote.execute('block.count', []);
        assert(!ret.error);
        env.height = ret;
        console.log(`获取当前主链区块数量, 返回码: ${ret.error?-1:0}，块链高度: ${ret}`);
    });

    it('9.16 网络状态', async () => {
        let ret = await remote.execute('sys.networkinfo', []);
        assert(!ret.error);
        console.log(`查询网络概要信息, 返回码: ${ret.error?-1:0}`);
    });

    it('9.17 节点状态', async () => {
        let ret = await remote.execute('sys.peerinfo', []);
        assert(!ret.error);
        console.log(`查询对等节点概要信息, 返回码: ${ret.error?-1:0}`);
    });

    it('9.18 矿机状态', async () => {
        let ret = await remote.execute('sys.mininginfo', []);
        assert(!ret.error);
        console.log(`查询矿机概要信息, 返回码: ${ret.error?-1:0}`);
    });

    it('9.19 通证状态', async () => {
        let ret = await remote.execute('sys.txoinfo', []);
        assert(!ret.error);
        console.log(`查询通证概要信息, 返回码: ${ret.error?-1:0}`);
    });
    
    it('9.20 查询连接', async () => {
        let ret = await remote.execute('sys.connectioncount', []);
        assert(!ret.error);
        console.log(`查询当前连接数, 返回码: ${ret.error?-1:0}`);
    });

    it('9.21 查询块链顶部', async () => {
        let ret = await remote.execute('block.best', []);
        assert(!ret.error);
        env.hash = ret;
        console.log(`获取当前主链顶部区块哈希，返回码: ${ret.error?-1:0}`);
    });

    it('9.22 查询块链高度', async () => {
        let ret = await remote.execute('block.count', []);
        assert(!ret.error);
        env.height = ret;
        console.log(`获取当前主链区块数量，返回码: ${ret.error?-1:0}`);
    });

    // it('查询区块：根据区块哈希查询区块内容', async () => {
    //     let ret = await remote.execute('block.info', [env.hash]);
    //     assert(!ret.error);
    //     assert(ret.hash == env.hash);
    // });

    // it('查询区块：根据区块高度查询区块内容', async () => {
    //     let ret = await remote.execute('block.info.byheight', [env.height]);
    //     assert(!ret.error);
    //     assert(ret.hash == env.hash);
    // });

    // it('系统状态：查询系统概要信息', async () => {
    //     let ret = await remote.execute('sys.info', []);
    //     assert(!ret.error);
    //     assert(ret.version == 'v2.0.0');
    // });

    // it('块链状态：查询块链概要信息', async () => {
    //     let ret = await remote.execute('sys.blockinfo', []);
    //     assert(!ret.error);
    // });

});
