/**
 * 联机单元测试：机构管理
 * Creted by liub 2020.04.28
 * @description
 * 厂商对应在链上发布数字资产的线下实体。百谷王链提供厂商注册、修改、核验相关管理功能
 */

const uuid = require('uuid/v1')
const assert = require('assert');
const remote = (require('./util/connector'))({structured: true});

let cp = {};

describe('11. 机构管理', () => {
    after(()=>{
        remote.close();
    });

    before(async () => {
        await remote.execute('miner.setsync.admin', [true]);
        let ret = await remote.execute('block.tips', []);
        if(ret.result[0].height < 100) {
            await remote.execute('miner.generate.admin', [100 - ret.result[0].height]);
        }
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('11.1 创建机构', async ()=>{
        //名称太短
        cp.name = 'abc'; 

        let ret = await remote.execute('cp.create', [cp.name, '']);
        assert(ret.error);

        //名称太长
        cp.name = '11111111111111111111111111111111111111111'; //名称不合法

        ret = await remote.execute('cp.create', [cp.name, '']);
        assert(ret.error);

        cp.name = uuid();   //修复名称
        cp.grate = 60;      //媒体分成太高

        ret = await remote.execute('cp.create', [cp.name, `,,,${cp.grate}`]);
        assert(ret.error);

        cp.grate = -1;      //分成不合法

        ret = await remote.execute('cp.create', [cp.name, `,,,${cp.grate}`]);
        assert(ret.error);

        cp.grate = 15;          //修复分成
        cp.url = '127';         //URL不合法

        ret = await remote.execute('cp.create', [cp.name, `${cp.url},,,${cp.grate}`]);
        assert(ret.error);

        cp.url = '127.0.0.1';    //修复URL
        cp.cls = 's';            //分类不合法

        ret = await remote.execute('cp.create', [cp.name, `${cp.url},,${cp.cls},${cp.grate}}`]);
        assert(ret.error);

        cp.cls = 'slg';          //修复分类

        ret = await remote.execute('cp.create', [cp.name, `${cp.url},,${cp.cls},${cp.grate}`]);
        assert(!ret.error);
        console.log(`提交机构名称、IP地址，创建一个机构，返回码: ${ret.error?-1:0}`);

        cp.cid = ret.result.cid; //记录CP编码
    });

    it('11.2 查询机构', async () => {
        //查询机构：出块前查询厂商信息 - 失败
        let ret = await remote.execute('cp.query', [[['cid', cp.cid]]]);
        assert(ret.result.list.length == 0);

        ret = await remote.execute('cp.remoteQuery', [[['cid', cp.cid]]]);
        assert(ret.result.list.length == 0);

        await remote.execute('miner.generate.admin', [1]);
        await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(2500); //数据上链有一定的延迟

        ret = await remote.execute('cp.query', [[['cid', cp.cid]]]);
        assert(ret.result.list.length == 1);
        console.log(`根据机构编号查询机构信息，返回码: ${ret.result.code}`);

        rt = await remote.execute('cp.remoteQuery', [[['cid', cp.cid]]]);
        assert(rt.result.list.length == 1);
    });

    it('11.3 修改机构：修改厂商分成比例 - 成功', async ()=>{
        //修改机构：修改厂商名称 - 名称非法
        cp.newName = 'ac';

        let ret = await remote.execute('cp.change', [cp.cid, `${cp.newName},${cp.url},,${cp.cls},${cp.grate}`]);
        assert(ret.error);

        //修改机构：修改厂商分成比例 - 失败
        cp.newName = "cp-new-"+uuid().slice(0,29);    //修复名称
        cp.grate = 50;          //分成比例超限

        ret = await remote.execute('cp.change', [cp.cid, `${cp.newName},${cp.url},,${cp.cls},${cp.grate}`]);
        assert(ret.error);

        //修复分成比例
        cp.grate = 49;

        ret = await remote.execute('cp.change', [cp.cid, `${cp.newName},${cp.url},,${cp.cls},${cp.grate}`]);
        assert(!ret.error);
        console.log(`修改机构已登记信息，返回码: ${ret.result.code}`);
        await remote.execute('miner.generate.admin', [1]);
    });

    it('11.3 修改机构：修改厂商分类 - 成功', async ()=>{
        cp.cls = 'rpg';

        let ret = await remote.execute('cp.change', [cp.cid, `${cp.newName},${cp.url},,${cp.cls},${cp.grate}`]);
        assert(!ret.error);
        await remote.execute('miner.generate.admin', [1]);
    });

    // it('查询机构：查询厂商信息 - 成功', async () => {
    //     //数据上链有一定的延迟，因此延迟一段时间后再查询
    //     await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(500); 

    //     let ret = await remote.execute('cp.remoteQuery', [[['name', cp.newName]]]);
    //     assert(ret.result.list.length == 1);
    // });
});