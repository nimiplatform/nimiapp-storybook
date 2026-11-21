## 0.1.10 · Storefront 展示资料、0.24 RC 载体与 Hosted Web 基线

- 同步原生端与托管 Web 端（`0.1.10`，`storybook.nimi.xyz`）产品基线，升级至公开 `@nimiplatform/app-tools` `0.16.0-rc.12`，沿用 `@nimiplatform/sdk` `0.24.0-rc.10` 与 `@nimiplatform/kit` `0.24.0-rc.16`，共享统一的 `nimi.storybook` 身份、主 PC Runtime 应用私有存储与 AIConfig 配置面。
- 补全 Nimi App Storefront 双语展示资料：归入「伙伴与世界（Companions & Worlds）」分类，提供中英双语使用指南、标签、核心亮点、16:9 封面及真实产品界面画廊（发现书架、沉浸式分支阅读、故事线分叉回溯、角色卡与作品导入、创作间 Studio 与作品编排）。
- 展示图片通过独立的聚合媒体包分发，不增加原生 `.nimiapp` 安装包体积。

## 0.1.8 · Published platform dependencies

Uses public npm SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1 and nimi-coding 0.6.5 with frozen registry lockfiles. Local Nimi tarball overrides are removed; Desktop-supervised development and installed Apps use the same published carrier.

# Storybook 0.1.7

补充受众、AI 文字输出、故事导出及外部媒体加载的事实声明，供支持该字段的 Nimi 展示。保留 SDK 0.11 / Kit 0.7 配对；不新增业务能力或运行门禁。发行与 Catalog 准入独立进行，声明不构成安全认证。

# Storybook 0.1.6

本次候选版本接入 Nimi App v2 发行信息协议：

- 随安装包提供应用图标、简介、使用说明、版本说明和许可证。
- 携带应用已声明的 App Access、能力需求与存储方式。
- 提供与包内同字节的信息资产，供 Nimi 在安装前展示应用信息。

此文件是当前源码候选的版本说明；正式发布与 Registry 审核是独立步骤。
