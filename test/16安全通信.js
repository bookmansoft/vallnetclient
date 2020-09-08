/**
 * 单元测试: GIP0023 安全通信
 * Creted by liub 2020.04.28
 * @description
 * 安全通信旨在确保通信过程的全程安全性
 */

const uuid = require('uuid/v1');
const assert = require('assert');
const remote = (require('./util/connector'))({structured: true});

let env = {
    alice: {name: `Alice-${uuid()}`,},
    bob: {name: `Bob-${uuid()}`,},
};

describe('16. 安全通信', function() {
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

        //设置长连模式
        remote.setmode(remote.CommMode.ws, async () => { });
        //设置事件处理句柄
		remote.watch(async msg => {
            // { 
            //     from:    'address msg sent from',
            //     to:      'address msg sent to',
            //     content: 'msg' 
            // }
            //console.log('get screet:', msg);
            if(msg.to == env.bob.address) {
                //如果Bob收到了消息，自动回复消息给Alice
                await remote.execute('comm.secret', [
                    msg.from,
                    `耶！${env.alice.name}`,
                    env.bob.name,
                ]);
            }
 		}, 'notify.secret');

        ret = await remote.execute('address.create', [env.bob.name]);
        assert(ret.code == 0);
        env.bob.address = ret.result.address;

        for(let i = 0; i < 2; i++) {
            await remote.execute('tx.create', [{"sendnow":true}, [{"value":20000000, "account": env.alice.name}]]);
            await remote.execute('tx.create', [{"sendnow":true}, [{"value":20000000, "account": env.bob.name}]]);
        }
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(500);

        ret = await remote.execute('address.create', [env.bob.name]);
        assert(ret.code == 0);
        env.bob.address = ret.result.address;
     });

    it('16.1 建立安全信道', async () => {
        //Alice使用Bob展示的会话地址，和Bob进行通讯握手，消息内容可设置为空
        let ret = await remote.execute('comm.secret', [
            env.bob.address,
            '',
            env.alice.name,
        ]);
        console.log(`用户A发起建立一个AB间的安全信道，返回码: ${ret.error?-1:0}`);
        
        await remote.wait(500);
    });

    it('16.2 发送安全消息', async () => {
        let ret = await remote.execute('comm.secret', [
            env.bob.address,
            `哦！${env.bob.name}`,
            env.alice.name,
        ]);
        await remote.wait(500);
        console.log(`用户A通过AB间的安全信道向B发送消息，返回码: ${ret.error?-1:0}`);
    });
});
