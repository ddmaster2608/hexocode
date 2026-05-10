---
abbrlink: ''
categories:
- - web
date: '2025-04-01T23:43:39.449736+08:00'
tags:
- web
- ctf
title: web之信息搜集
updated: '2025-05-24T19:34:43.187+08:00'
cover: https://s2.loli.net/2025/08/20/9xW1En72oUQrKuA.jpg
---
# 按f12

梦开始的地方

# ctrl+u

f12被禁用可以用这个，或者通过在url头部添加 `view-source:`

# F12后查看“网络”标签

进入后查看响应包相关信息找到flag  cookie等

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

# dns检查查询

cmd运行 例如nslookup -qt=txt flag.ctfshow.com  

nslookup -query=type(类型) 域名     //一般是txt啦，txt里面好放东西

# 技术文档塞东西

一看容器前端做的很好的那种网站啊 上下找找，估计有技术文档啥的 document 打开里面有东西

# /editor

ctfshow 14题   访问url/editor 后能看见一个编辑器，编辑器里点添加附件，就能看到所有目录都被遍历了

挺神奇的

# /admin

遇到好几个题都是在/admin下有一个登录页面

不要放过任何一个可疑信息 eg. ctfshow web15中就出现了一个qq邮箱，虽然不知道啥用但是很可疑，果然/admin后，需要登录，登录不知道密码怎么办，有个找回密码，点击后密保问题是居住地是哪里

qq号就派上用场了，搜一下qq号就可以看到居住地  (怎么一股misc味

# /tz.php

php探针是用来探测空间、服务器运行状况和PHP信息用的，探针可以实时查看服务器硬盘资源、内存占用、网卡流量、系统负载、服务器时间等信息

* 根据提示用到php探针知识点
* 输入默认探针tz.php
* 打开后点击phpinfo就可以查看到flag

# url/index.php.swp

vim缓存信息泄露
