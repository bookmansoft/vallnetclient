/**
 * 联机单元测试：多签合约 - 利用托管合约实现多签合约流程
 */

const assert = require('assert')
const uuidv1 = require('uuid/v1');
const remote = (require('./util/connector'))();

//声明中间环境变量
let env = {
    alice: uuidv1(),
    bob: uuidv1(),
    robin: uuidv1(),
    amount: 100000000,
    address:{},
    accountKey:{},
};

describe('12. 多签合约 - 利用托管合约实现多签合约流程', () => {
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

        //创建账户：第三方伙伴Robin建立账户
        let msg = await remote.execute('address.create', [env.robin]);
        assert(msg.address);
        env.address[env.robin] = msg.address;

        console.log(`[模拟输入数据开始]`);
        console.log(`- 账号A: ${env.alice}`);
        console.log(`- 账号B: ${env.bob}`);
        console.log(`- 第三方账号C: ${env.robin}`);
        console.log(`- 多签类型: 2/2`);
        console.log(`- 向第三方账号C转账金额: ${env.amount}`);
        console.log(`[模拟输入数据结束]`);
    });

    it('12.1 创建多签钱包', async () => {
        //Alice创建多签钱包
        let msg = await remote.execute('wallet.create', [env.alice,'multisig',2,2,,,,true]);
        //console.log(`账号A创建多签钱包:`, msg.wid, msg.id);
        assert(msg.account.accountKey);
        env.address[env.alice] = msg.id;
        env.accountKey[env.alice] = msg.account.accountKey;
        console.log(`提交账号A，为其创建一个专属多签钱包，返回码: ${msg.error?-1:0}`);

        //Bob创建多签钱包
        msg = await remote.execute('wallet.create', [env.bob,'multisig',2,2,,,,true]);
        //console.log('账号B创建多签钱包:', msg.wid, msg.id);
        assert(msg.account.accountKey);
        env.address[env.bob] = msg.id;
        env.accountKey[env.bob] = msg.account.accountKey;
        console.log(`提交账号B，为其创建一个专属多签钱包，返回码: ${msg.error?-1:0}`);

        //转账交易：为Alice和Bob储值
        await remote.execute('tx.send', [env.address[env.alice], 200000000]);
        await remote.execute('tx.send', [env.address[env.alice], 200000000]);
        await remote.execute('tx.send', [env.address[env.alice], 200000000]);
        await remote.execute('tx.send', [env.address[env.bob], 200000000]);
        await remote.execute('tx.send', [env.address[env.bob], 200000000]);
        await remote.execute('tx.send', [env.address[env.bob], 200000000]);
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('12.2 创建多签合约', async () => {
        //注册合约
        let msg = await remote.execute('sc.register', [{'type':'multisig', 'm':2, 'n':2}], env.alice);
        assert(msg.dst);
        console.log(`提交账号A，为其创建一个多签合约，返回码: ${msg.error?-1:0}`);

        //设置合约地址
        env.address['contract'] = msg.dst;

        //上链
        await remote.execute('miner.generate.admin', [1]);
    });

    it('12.3 共建多签合约', async () =>{
        //Alice构造合约驱动交易，上传钱包公钥和通信地址
        await remote.execute('sc.run', [
            `${env.address['contract']},50000`,
            {'oper': 'pubk', 'pubk': env.accountKey[env.alice], 'addr': env.address[env.alice]},
            env.alice,
        ]);

        //Bob构造合约驱动交易，上传钱包公钥和通信地址
        await remote.execute('sc.run', [
            `${env.address['contract']},50000`,
            {'oper': 'pubk', 'pubk': env.accountKey[env.bob], 'addr': env.address[env.bob]},
            env.bob,
        ]);

        //将上述交易上链，触发 mssendpubk/receive 事件，钱包自动生成并广播新的交易：上传生成的多签地址
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
        
        //将钱包广播的新交易上链
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);

        //查询并记录多签收款地址
        let msg = await remote.execute('sc.query', [[['options.type','multisig'],['options.dst',env.address['contract']]]]);
        assert(msg.list[0].options.puba);
        env.address['multisig'] = msg.list[0].options.puba;
        console.log(`多方分别上传自己的公钥, 共建多签合约，返回码: ${msg.error?-1:0}, 合约地址: ${msg.list[0].options.puba}`);

        //第三方向多签地址转账，Alice和Bob的多签钱包将收到对应UTXO
        await remote.execute('tx.send', [env.address['multisig'], 250000000]);
        await remote.execute('miner.generate.admin', [1]);
    });

    it('12.4 主动运行多签合约', async () => {
        let msg = await remote.execute('balance.all', [env.robin]);
        env.balance = msg.confirmed;

        //Alice动用多签钱包，构造一笔向Robin转账的多签交易
        //2020.08.05 注意此处暴露了一个严重的安全问题：缺乏钱包访问控制机制，用户被授权连接后，可任意指定待操控钱包
        //一种简便易行的方案: 限定用户创建钱包时，只能使用自己名下的地址作为索引，在访问特定钱包时添加地址归属检测
        remote.setup({type: 'testnet', id: env.address[env.alice]});
        msg = await remote.execute('tx.create', [
            {'rate':10000, 'sendnow':false}, 
            [
                {'value':env.amount, 'address':env.address[env.robin]},
            ],
        ]);
        assert(msg.hex);
        env.trans = msg.hex;
        console.log(`账号A动用多签钱包向第三方账号C发起转账，金额${env.amount}，返回码: ${msg.error?-1:0}`);

        remote.setup({type: 'testnet', id: 'primary'});

        //此时由于未达门限要求，Robin尚未收到转账
        msg = await remote.execute('balance.all', [env.robin]);
        //assert(msg.confirmed - env.balance == 0);
        console.log(`账号C${env.robin}查询得知收到转账金额: ${msg.confirmed - env.balance}`);

        //Alice动用普通钱包发送合约驱动交易，征集门限签名
        msg = await remote.execute('sc.run', [
            `${env.address['contract']},20000`,
            {'oper':'sign','tx':env.trans,'addr':env.address[env.alice]},
            env.alice,
        ]);
        console.log(`账号A主动运行多签合约，以发起征集门限签名合约，返回码: ${msg.error?-1:0}`)


        //上链，触发 mssendtx/receive 事件
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('12.5 辅助运行多签合约', async () => {
        //todo 需要进一步用访问账号限定 tx.mstrans 返回的交易条目
        let msg = await remote.execute('tx.mstrans', [env.bob]);
        for(let trans of msg) {
            //tx.mstrans.sign 指令同时用到了多签钱包和普通钱包账户，需要检测多签钱包的归属
            let ret = await remote.execute('tx.mstrans.sign', [trans.txid, env.bob]);
            console.log(`账号B查询多签交易列表，动用多签钱包补签后广播, 返回码: ${(ret&&ret.error)?-1:0}`);
        }

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);

        //Robin最终收到转账
        msg = await remote.execute('balance.all', [env.robin]);
        assert(msg.confirmed - env.balance == env.amount);
        console.log(`账号C${env.robin}查询得知收到转账金额: ${msg.confirmed - env.balance}`);
    });
});
