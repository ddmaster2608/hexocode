---
abbrlink: ''
categories:
- - web
date: '2025-04-01T23:43:39.449736+08:00'
tags:
- web
- ctf
title: web之信息搜集
updated: '2025-04-01T23:58:03.310+08:00'
---
# 按f12

梦开始的地方

# ctrl+u

f12被禁用可以用这个，或者通过在url头部添加 `view-source:`

# F12后查看“网络”标签

进入后查看响应包相关信息找到flag

# robots.txt

`/robots.txt`

# index.phps

`/index.phps`

和index.php的区别


| 特性               | `index.php`    | `index.phps`                 |
| ------------------ | -------------- | ---------------------------- |
| **文件用途**       | 执行 PHP 脚本  | 展示 PHP 源代码              |
| **服务器处理方式** | 解析并执行代码 | 显示代码（需配置）或直接返回 |

# www.zip

`/www.zip`

# /.git/index.php

`/.git/index.php`

.git源码泄露：采用git管理项目时，上传项目忘记删除.git文件，攻击者可通过该文件恢复源码历史版本，从而造成源码泄露

# .svn

`/.svn`

与git一样，SVN也是常用的代码版本管理工具 这里url+/.svn即可
