# 生成等待误判修复（运行脚本2026.10.25.5）

用户反馈：没有AI回复，刷新后检查资料仍提示“请等待当前生成结束后再更新”。

## 已查明的代码问题

旧运行脚本对tavern_events.GENERATION_STARTED无条件设置generating=true，再用此标记与builtin.duringGenerating()相或。SillyTavern的提示词/Token预计算也会发送此开始事件，第三参数dryRun=true，预计算结束可以直接返回而不发GENERATION_ENDED。旧标记因此会一直保持，刷新后再次预计算又可重新触发。原生生成在命令拦截等提前返回时也可能缺少配对结束通知。

依据：[SillyTavern Generate实现](https://github.com/SillyTavern/SillyTavern/blob/release/public/script.js)、[酒馆助手事件签名](https://github.com/N0VI028/JS-Slash-Runner/blob/main/%40types/iframe/event.d.ts)、[酒馆助手实时状态实现](https://github.com/N0VI028/JS-Slash-Runner/blob/main/src/function/builtin.ts)。

## 修复

- 原生预计算不改变生成状态、不取消正在下载的更新。
- 普通生成以builtin实时布尔值判断，去掉永久粘住的generating标记。真实开始仍使在途同步失效，保留每次写入前的检查。
- 酒馆助手静默请求按generation_id跟踪；某请求结束或停止只移除它自己，避免一个请求结束放行另一个正在运行的请求。切换聊天清理旧会话记录。
- 支持从TavernHelper.builtin命名空间查找实时接口；接口返回异常类型时明确报错并不写入，避免把对象当作true。
- 增加只读generationState诊断，保持聊天、MVU、人物数值和剧情进度不在同步写入范围。

## 验证

使用修改前运行脚本执行新增回归场景，可复现dryRun后不再更新；使用修复版，同样场景通过。共34组真实模块离线测试通过，包括此前19组资料更新场景，以及预计算无结束事件、下载中预计算、正常结束/停止/漏结束、提前终止、多后台请求、按ID停止、真实生成在下载中开始、命名空间接口及异常返回值。

测试在Node运行实际运行脚本和合并模块，模拟酒馆助手接口；没有连接用户实际酒馆验证。资料包、角色卡、地图、已有剧情正文没有改动。本次无需重建内容清单，内容包版本保持2026.10.25.4。

## 使用

已安装脚本可先刷新酒馆再点“检查资料更新”；若仍取到旧缓存，将“鸣潮资料自动更新”的内容替换为以下固定提交的入口，关闭再启用一次。无需导入整张角色卡。新版安装JSON也使用这一入口，只保留一个同名脚本。

```js
await import('https://cdn.jsdelivr.net/gh/qq85316902-cloud/tga-wuwa@f0ee74ddb7f22dbd9d7e12e385b6e67c3e430c71/dist/solaris-sync.js');
```

入口固定到修复版运行代码，资料清单仍读取main分支，后续主线资料更新照常获取。CDN清缓存工具本次遇到人机验证，未完成清缓存；固定提交入口用于避免依赖旧分支缓存。
