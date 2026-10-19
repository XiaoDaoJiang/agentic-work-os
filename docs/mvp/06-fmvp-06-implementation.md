# FMVP-06 Founder 真实任务与摩擦记录

2026-10-19，状态IN_PROGRESS。05最终真实回归已通过并记录于 `dc535e8`，本切片分支为 `codex/fmvp-06-founder-use`。当前在处理真实任务的捕获兼容前置，不代表已启动真实Task或取得人类审核。

## 任务与最小范围

源仓库为 `E:/Projects/power-tool`。获取Android安装包MD5之前，校验URL解码后的路径文件名具有有效`.apk`后缀。明确拒绝 `https://gyenno.oss-cn-beijing.aliyuncs.com/pub/apk/ruiyun/%E7%9D%BF%E4%BA%91_2.10.7apk`，版本号中的点不能视为后缀；正常APK的流式MD5路径继续可用。拒绝原因应在已有界面可见，不把错误文字填成MD5。

原仓库存在其他工作。执行前重新检查HEAD和状态，只使用完整已提交仓库的隔离副本作为MVP输入，并在记录中明确原始来源与提交。不得复制未提交私有配置、直接修改原仓库、自动应用交付或伪造人类Accept。

## 顺序与检查

- [x] 05最终真实回归完成后切独立功能分支，保留用户未提交文件。
- [ ] 先复现全仓属性兼容障碍。按 `verification-output/fmvp-06/capture-compat-plan.md` 用精确测试放宽无字节转换属性，保留遗漏属性、转换、过滤器、漂移拒绝。
- [ ] 相关capture、replay、server验证通过后，在全仓隔离副本测量capture/replay；不删除属性文件或截断业务子目录来避开失败。
- [ ] 执行身份发生变化时重新实际运行完整G1与匹配G2；旧记录不改写。未通过不开放真实Task。
- [ ] 通过MVP创建真实Task并冻结DoD和验证命令，再启动真实Run。记录Task/Run、source/base、验证结果与sealed Package事实。
- [ ] 重开查看可审核结果，记录实际操作、录入成本、外部终端依赖和阻碍下一次使用的少量问题。没有第二项真实任务就写没有；不推断满意度或独立复用。
- [ ] 补齐客观证据、未验证项和本地交付说明。真实任务失败同样保留，不用演示或注入用例替代。

## 当前证据与限制

只读定位为 `py-tool/ruiyun/version_tool/util.py` 与Android MD5 UI调用。当前capture会拒绝仓库内`.gitattributes`，PowerTool含tracked `kibana/.gitattributes`；兼容方案尚未实施。现有Python3.12.0、requests2.31.0、Tk8.6已实际可导入，这不是代码任务通过或GUI使用证据。

尚未创建实际PowerTool Task/Run，未下载样例安装包，未修改原仓库，未取得人类接受决定；原Product/Technical Gate与外部验证计数保持原记录。
