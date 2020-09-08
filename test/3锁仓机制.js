/**
 * 单元测试: 锁仓机制 - GIP0027
 * Creted by liub 2020.04.20
 * Modified by liub 2020.05.13 新增对 'cst' 的支持
 */

const assert = require('assert');
const uuidv1 = require('uuid/v1');
const remote = (require('./util/connector'))({structured: true});

const gamegold = require('gamegold');
const consensus = gamegold.consensus;
const {outputLockType} = gamegold.script;

let env = {
    alice: {},
    bob: {},
    amount: 5000000,
    delay: 3,
};

let types = [
    outputLockType.CHECKABSOLUTEBLOCK,
    outputLockType.CHECKABSOLUTETIME,
    outputLockType.CHECKRELATIVEBLOCK,
    outputLockType.CHECKRELATIVETIME,
];

let typeName = {};
typeName[outputLockType.CHECKABSOLUTEBLOCK] = '3.1 构造绝对高度锁仓交易';
typeName[outputLockType.CHECKABSOLUTETIME] = '3.2 构造绝对时间锁仓交易';
typeName[outputLockType.CHECKRELATIVEBLOCK] = '3.3 构造相对高度锁仓交易';
typeName[outputLockType.CHECKRELATIVETIME] = '3.4 构造相对时间锁仓交易';

describe('3. 锁仓机制 - GIP0027', function() {
    after(()=>{
        remote.close();
    });

    before(async () => {
        await remote.execute('miner.setsync.admin', []);
        let ret = await remote.execute('block.tips', []);
        if(ret.result[0].height < 100) {
            await remote.execute('miner.generate.admin', [100-ret.result[0].height]);
        }

        //让中值时间赶上当前时间
        ret = await remote.execute('miner.generate.admin', [20]);
        assert(ret.code == 0);

        env.alice.name = uuidv1();
        env.bob.name = uuidv1();

        ret = await remote.execute('address.create', [env.alice.name]);
        assert(ret.code == 0);
        env.alice.address = ret.result.address;

        ret = await remote.execute('address.create', [env.bob.name]);
        assert(ret.code == 0);
        env.bob.address = ret.result.address;
    });

    for(let type of types) {
        it(`构造锁交易`, async () => {
            let sim = env.delay;
            switch(type) {
                case outputLockType.CHECKRELATIVEBLOCK: {
                    break;
                }

                case outputLockType.CHECKABSOLUTEBLOCK: {
                    let ret = await remote.execute('block.tips', []);
                    sim = ret.result[0].height + env.delay;

                    break;
                }

                case outputLockType.CHECKABSOLUTETIME: {
                    let ret = (Date.now()/1000)|0;
                    sim = ret + env.delay*3;

                    break;
                }

                case outputLockType.CHECKRELATIVETIME: {
                    sim = 1; //标准设置下代表2^9=512秒
                    break;
                }
            }

            let ret = await remote.execute('tx.create', [
                {'sendnow':true}, 
                [{
                    'value': env.amount, 
                    'address': env.alice.address, 
                    'locktype': type, 
                    'locktime': sim,
                }],
            ]);
            assert(ret.code == 0);
            console.log(`${typeName[type]}, 返回码: ${ret.code}`);
            
            ret = await remote.execute('tx.send', [
                env.bob.address,
                env.amount - 10000,
                env.alice.name,
            ]);
            assert(ret.code != 0);
            //console.log('验证: Alice试图花费这笔锁定输出失败');
        });
    }

    it('解锁交易', async () => {
        for(let type of types) {
            switch(type) {
                case outputLockType.CHECKRELATIVEBLOCK: {
                    let ret = await remote.execute('miner.generate.admin', [env.delay]);
                    assert(ret.code == 0);
                    break;
                }
    
                case outputLockType.CHECKABSOLUTEBLOCK: {
                    let ret = await remote.execute('miner.generate.admin', [env.delay]);
                    assert(ret.code == 0);
                    break;
                }
    
                case outputLockType.CHECKABSOLUTETIME: {
                    await (async (time) => {return new Promise(resolve => {setTimeout(resolve, time);});})(env.delay*3*1000);
                    //为满足中值时间的要求，多挖了几个块
                    let ret = await remote.execute('miner.generate.admin', [15]);
                    assert(ret.code == 0);
                    break;
                }
    
                case outputLockType.CHECKRELATIVETIME: {
                    await (async (time) => {return new Promise(resolve => {setTimeout(resolve, time);});})((1<<consensus.SEQUENCE_GRANULARITY)*1000);
                    //为满足中值时间的要求，多挖了几个块
                    let ret = await remote.execute('miner.generate.admin', [15]);
                    assert(ret.code == 0);
                    break;
                }
            }
        }

        remote.wait(2000);

        let ret = await remote.execute('balance.all', [env.alice.name]);
        assert(ret.code == 0);
        assert(ret.result.locked == 0);
        console.log(`通过提升块链高度来解锁交易，返回码: ${ret.code}, 锁仓额: ${ret.result.locked}`);
    });
});