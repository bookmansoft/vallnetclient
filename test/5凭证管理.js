/**
 * 联机单元测试：凭证管理
 * @description
 */

const uuid = require('uuid/v1')
const assert = require('assert')
const remote = (require('./util/connector'))({structured: true})

describe('5. 凭证管理', () => {
    after(()=>{
        remote.close();
    });

    before(async () => {
        //强制设置同步完成标志
        await remote.execute('miner.setsync.admin', []);
        //检测块高度，必要时进行挖矿以确保创世区块成熟
        let ret = await remote.execute('block.tips', []);
        if(ret.result[0].height < 100) {
            await remote.execute('miner.generate.admin', [100-ret.result[0].height]);
        }
    });

    //重复多次测试
    for(let i = 0; i < 1; i++) {
        //CP
        let cp = {
            name: "stock-cp-"+ uuid().slice(0,27),
            id: '',
        };

        //买家 alice
        let alice = {
            name: "stock-alice"+ uuid().slice(0,25),
            addr: '',
            sn: ()=>{return "oid-alice-"+ uuid().slice(0,26);},     //订单编号
        };
        //卖家 bob
        let bob = {
            name: "stock-bob-"+ uuid().slice(0,26),
            addr: '',
            sn: ()=>{return "oid-bob-"+ uuid().slice(0,28);},     //订单编号
        };

        console.log(`[模拟输入数据开始]`);
        console.log(`- 机构名称: ${cp.name}`);
        console.log(`- 发起方账户: ${alice.name}`);
        console.log(`- 对手方账户: ${bob.name}`);
        console.log(`- 初始发行价格: 1000`);
        console.log(`- 初始发行数量: 1000`);
        console.log(`- 支付交易总额: 2000000000`);
        console.log(`- 媒体分润比例: 15%`);
        console.log(`[模拟输入数据结束]`);

        it('5.1 一级市场发行', async () => {
            //一级市场发行 - CP不存在
            let ret = await remote.execute('stock.offer', [cp.name, 1000, 1000]);
            assert(!!ret.error);

            //一级市场发行 - 非法账户

            //注册一个新的CP, 指定 15% 的媒体分成
            ret = await remote.execute('cp.create', [cp.name, '127.0.0.1,,slg,15']);
    
            //确保该CP数据上链
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询并打印CP信息
            ret = await remote.execute('cp.byName', [cp.name]);
            cp.id = ret.result.cid;
    
            //注册alice的子帐号, 记录对应特定CP的专属地址
            ret = await remote.execute('cp.user', [cp.id, alice.name, null, alice.name]);
            alice.cid = cp.id;
            alice.addr = ret.result.data.addr;
    
            //注册bob的子帐号, 记录对应特定CP的专属地址
            ret = await remote.execute('cp.user', [cp.id, bob.name, null, bob.name]);
            bob.cid = cp.id;
            bob.addr = ret.result.data.addr;

            //将alice设置为bob的推广员
            await remote.execute('order.setGuider', [alice.addr, cp.id, bob.addr]);

            //确保该CP数据上链
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('stock.offer', [cp.id, 1000, 1000, alice.name]);
            assert(!!ret.error);

            //一级市场发行 - 非法数量
            
            //数量太多
            ret = await remote.execute('stock.offer', [cp.id, 1.1e+6, 1000]);
            assert(!!ret.error);
            //console.log(ret.error.message);
    
            //数量太少
            ret = await remote.execute('stock.offer', [cp.id, 99, 1000]);
            assert(!!ret.error);
            //console.log(ret.error.message);
    
            ret = await remote.execute('cp.byId', [cp.id]);
            assert(ret.result.stock.sum === 0);

            //一级市场发行 - 非法金额

            //金额必须大于0
            ret = await remote.execute('stock.offer', [cp.id, 1000, 0]);
            assert(!!ret.error);
            //console.log(ret.error.message);
    
            //金额必须大于0
            ret = await remote.execute('stock.offer', [cp.id, 1000, -1]);
            assert(!!ret.error);
            //console.log(ret.error.message);
    
            //金额不能大于 5000000
            ret = await remote.execute('stock.offer', [cp.id, 100, 5000001]);
            assert(!!ret.error);
            //console.log(ret.error.message);
    
            ret = await remote.execute('cp.byId', [cp.id]);
            assert(ret.result.stock.sum === 0);

            //一级市场发行 - 成功

            //数量、价格符合标准，还要能够支付 5% 发行总额的手续费
            ret = await remote.execute('stock.offer', [cp.id, 1000, 1000]);
            assert(!ret.error);
            console.log(`提交厂商编号、发行价格、发行数量，进行一级市场商业凭证发行，返回码: ${ret.code}`);
    
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('cp.byId', [cp.id]);
            assert(ret.result.stock.sum === 1000);
            assert(ret.result.stock.price === 1000);
        });
    
        it('5.2 一级市场购买', async () => {
            //Alice 购买凭证, 余额不足，失败
            let ret = await remote.execute('stock.purchase', [cp.id, 500, alice.name]);
            assert(!!ret.error);

            //为用户转账
            await remote.execute('tx.send', [alice.addr, 5000000000]);
            await remote.wait(1000);

            //Alice 购买 500 凭证
            ret = await remote.execute('stock.purchase', [cp.id, 500, alice.name]);
            assert(!ret.error);

            console.log(`提交厂商编号、购买数量、购买者账号，进行一级市场商业凭证购买，返回码: ${ret.code}`);

            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询 Alice 的凭证余额 === 500
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', alice.addr]]]);
            assert(ret.result.list[0].sum === 500);
            assert(ret.result.list[0].price === 1000);

            //Alice 购买超过剩余总量的凭证，接口上没有报错，但操作最终失败了
            ret = await remote.execute('stock.purchase', [cp.id, 600, alice.name]);

            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询 Alice 的凭证余额 === 500
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', alice.addr]]]);
            assert(ret.result.list[0].sum === 500);
            assert(ret.result.list[0].price === 1000);
        });
    
        it('5.3 无偿转让', async () => {
            //转账总额超过凭证余额
            let ret = await remote.execute('stock.send', [cp.id, 600, bob.addr, alice.name]);

            //查询 Bob 的凭证余额，没有发生变化
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', bob.addr]]]);
            assert(ret.result.list.length === 0);

            //alice 转给 bob 100
            ret = await remote.execute('stock.send', [cp.id, 100, bob.addr, alice.name]);
            assert(!ret.error);
            console.log(`提交厂商编号、转让数量、转让地址、转让者账号，进行商业凭证无偿转让，返回码: ${ret.code}`);
    
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询 Alice 的凭证余额 === 400
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', alice.addr]]]);
            assert(ret.result.list[0].sum === 400);
    
            //查询 Bob 的凭证余额 === 100
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', bob.addr]]]);
            assert(ret.result.list[0].sum === 100);
        });
    
        it('5.4 二级市场拍卖', async () => {
            //alice 挂牌 200 凭证
            let ret = await remote.execute('stock.bid', [cp.id, 200, 2000, alice.name]);
            assert(!ret.error);
            console.log(`提交厂商编号、拍卖数量、拍卖价格、拍卖者账号，进行二级市场商业凭证拍卖，返回码: ${ret.code}`);
    
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('stock.bid.list', [[['cid', cp.id]]]);
            assert(ret.result.list[0].addr === alice.addr);
            assert(ret.result.list[0].stock.sum === 200);
            assert(ret.result.list[0].stock.price === 2000);
        });
    
        it('5.5 二级市场购买', async () => {
            //Bob购买凭证，因为金额不足失败
            let ret = await remote.execute('stock.auction', [cp.id, alice.addr, 100, 2000, bob.name]);
            assert(!!ret.error);

            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询 Bob 的凭证余额
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', bob.addr]]]);
            assert(ret.result.list[0].sum === 100);

            //向Bob转账，以使其拥有足够的资金
            await remote.execute('tx.send', [bob.addr, 5000000000]);
            await remote.wait(1000);

            //Bob购买凭证 100 
            ret = await remote.execute('stock.auction', [cp.id, alice.addr, 100, 2000, bob.name]);
            assert(!ret.error);
            console.log(`提交厂商编号、拍卖者地址、竞拍数量、竞拍价格、竞拍者账号，进行二级市场商业凭证购买，返回码: ${ret.code}`);

            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询 Bob 的凭证余额 === 200
            ret = await remote.execute('stock.list.wallet', [[['cid', cp.id], ['addr', bob.addr]]]);
            await remote.wait(1000);
            assert(ret.result.list[0].sum === 200);

            //验证凭证分配的有效性
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('stock.record', [7, cp.id, 0]);
            assert(ret.result.list[0].price == 2000);
    
            ret = await remote.execute('stock.list', [[['cid', cp.id]]]);
            assert(ret.result.list.length == 2);
            
            //一共出售了 500 凭证
            for(let item of ret.result.list) {
                if(item.addr == alice.addr) {
                    //alice 现在有 300
                    assert(item.sum === 300);
                } else if(item.addr == bob.addr) {
                    //bob 现在有 200
                    assert(item.sum === 200);
                }
            }
        });
    
        it('5.6 商业支付: 发起支付交易，然后查询支付流水', async () => {
            //累计分成不足不能继续发行
            let ret = await remote.execute('cp.byId', [cp.id]);
            assert(ret.result.stock.sum === 500); 
            assert(ret.result.stock.price === 1000);
            assert(ret.result.stock.hSum === 500);
            assert(ret.result.stock.hPrice === 1000);
    
            ret = await remote.execute('stock.offer', [cp.id, 1000, 1000]);
            assert(!!ret.error); //无法继续发行
    
            //挖矿以确保数据上链
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('cp.byId', [cp.id]);
            //注意数值没有发生变化
            assert(ret.result.stock.sum === 500); 
            assert(ret.result.stock.price === 1000);
            assert(ret.result.stock.hSum === 500);
            assert(ret.result.stock.hPrice === 1000);

            //连挖30个区块，确保生成CP快照，确保交易分成顺利进行
            //@note 在之前的测试中，连挖10个块尚不足以确保生成CP快照，改为30个后测试恢复正常
            await remote.execute('miner.generate.admin', [30]); 
            await remote.wait(1000);

            //发起一笔支付交易，使用bob的子账户支付
            ret = await remote.execute('order.pay', [cp.id, bob.name, bob.sn(), 1000000000, bob.name]);
            assert(!ret.error);
            //@note 此处sn使用了随机数，实际运用中建议使用自增长序列，以便后期增量查询
            //@note 上述支付将按照约定，分配给凭证持有方(alice bob)、媒体方(alice)
            console.log(`提交厂商编号、支付金额、支付者账号，进行商业支付，返回码: ${ret.code}`);

            //再发起一笔支付交易，使用bob的子账户支付
            ret = await remote.execute('order.pay', [cp.id, bob.name, bob.sn(), 1000000000, bob.name]);
            assert(!ret.error);
            //@note 上述支付将按照约定，分配给凭证持有方(alice bob)、媒体方(alice)

            //挖矿以确保数据上链
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            //查询bob的交易流水 - 两笔
            ret = await remote.execute('order.query.wallet', [[['cid', cp.id]], bob.name]);
            assert(!ret.error && ret.result.list.length === 2);
        });
    
        it('5.7 查询媒体分润', async () => {
            //查询作为bob的推荐者，alice的媒体分成 - 两笔共 20 分得 15% = 3, 注意媒体分成是提前结算的
            let ret = await remote.execute('stock.record', [5, cp.id, 0, [['@total','price']]]);
            assert(!ret.error);
            assert(ret.result.price === 300000000, ret.result.price);
            console.log(`提交厂商编号，查询导流媒体分润总额，返回码: ${ret.code}, 分润总额: ${ret.result.price}`);
        });

        it('5.8 查询凭证分润', async () => {
            //查询凭证分成（扣除媒体分成后）, 包括 alice(300/5000500) 的两笔， bob(200/5000500) 的两笔，合计 1700000000*500/5000500, CP保留利润不计入其中
            let ret = await remote.execute('stock.record', [4, cp.id, 0, [['@total','price']]]);
            assert(!ret.error);
            assert(ret.result.price === 169980, ret.result.price);
            console.log(`提交厂商编号，查询凭证分润总额，返回码: ${ret.code}, 分润总额: ${ret.result.price}`);
        });

        /**
         * 注：由于连挖4032个块会导致连接器超时，在 BLOCK_DAY = 144 的设定下，可跳过本条测试
         */
        it('5.9 一级市场扩发 - 度过冷却期后再次发行凭证成功', async () => {
            //一级市场扩发 - 冷却期内不能继续发行
            let ret = await remote.execute('stock.offer', [cp.id, 1000, 1000]);
            assert(!!ret.error); //冷却期内不能继续发行
    
            //确保数据上链
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('cp.byId', [cp.id]);
            //注意数值没有发生变化
            assert(ret.result.stock.sum === 500); 
            assert(ret.result.stock.price === 1000);
            assert(ret.result.stock.hSum === 500);
            assert(ret.result.stock.hPrice === 1000);

            //连续记账，确保度过冷却期
            await remote.execute('miner.generate.admin', [42]);
            await remote.wait(1000);

            ret = await remote.execute('stock.offer', [cp.id, 1000, 1000]);
            assert(!ret.error);
            console.log(`提交厂商编号、扩发数量、扩发价格，进行一级市场商业凭证扩发，返回码: ${ret.code}`);
    
            //挖矿以确保数据上链
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);

            ret = await remote.execute('cp.byId', [cp.id]);
            assert(ret.result.stock.sum === 1000); 
            assert(ret.result.stock.price === 1000); 
            assert(ret.result.stock.hSum === 500);
        });
    }
});
