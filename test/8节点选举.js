/**
 * 单元测试: 节点选举
 * @description 
 * 节点可通过如下两种方式获取记账权
 * 1. 获取官方矿产证
 * 2. 获取社区投票认可
 */

const assert = require('assert')
const uuid = require('uuid/v1');
const connector = require('./util/connector');

//引入核心库，在包引入模式下直接使用 require('gamegold')
const gamegold = require('gamegold');
const consensus = gamegold.consensus;

let env = {
    bossOid: 'xxxxxxxx-vallnet-boss-tokenxxxxx0000',
    bossCid: 'xxxxxxxx-vallnet-boss-xxxxxxxxxxxxxx',
    miner: {
        pid: '',
        address: '',
    },
    alice: {
        name: uuid(),
        address: '',
    }
}

const remote = connector();

describe('8. 节点选举', () => {
    after(()=>{
        remote.close();
    });

    before(async () => {
        await remote.execute('miner.setsync.admin', [true]);
        let ret = await remote.execute('block.tips', []);
        if(ret[0].height < 100) {
            await remote.execute('miner.generate.admin', [100 - ret[0].height]);
        }
    });

    for(let i = 0; i < 1; i++) {
        it('8.1 验证选举', async () => {
            let ret = await remote.execute('address.create', [env.alice.name]);
            assert(!ret.error);
            env.alice.address = ret.address;

            ret = await remote.execute('miner.generateto.admin', [1, env.alice.address]);
            assert(!!ret.error);
            console.log(`投票前，提交未当选账号(${env.alice.name})执行记账，返回码: ${ret.error?-1:0}`);
        });

        it('8.2 投票选举', async () => {
            let ret = await remote.execute('vote.send', [env.alice.address, 100000000]);
            assert(!ret.error);
            console.log(`提交账号名称${env.alice.name}、投票数，为其记账权进行投票，返回码: ${ret.error?-1:0}`);

            //确保记账权变化生效
            await remote.execute('miner.generate.admin', [consensus.BLOCK_2WEEK]); // 过大或过小都会导致统计周期意外切换，从而影响投票权的有效性
        });

        it('8.3 查询选举', async () => {
            let ret = await remote.execute('vote.check', [env.alice.address]);
            assert(!ret.error);
            assert(ret.vote > 0);
            console.log(`提交账号名称(${env.alice.name})查询其当前选举权，返回码: ${ret.error?-1:0}`);

            //验证选举权：投票后，Alice记账成功
            ret = await remote.execute('miner.generateto.admin', [1, env.alice.address]);
            assert(!ret.error);
        });
    }
});
