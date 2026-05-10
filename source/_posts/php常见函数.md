---
abbrlink: ''
categories:
- - web
date: '2025-04-01T23:08:53.282084+08:00'
tags:
- web
- ctf
title: php常见函数
updated: '2025-04-01T23:27:15.479+08:00'
cover: 'https://files.seeusercontent.com/2026/05/10/l7eQ/Image_37623218591428.png'
---
# 在此贴中将会更新一些在做题过程中遇到的php常见函数

## system()

system()用于执行系统命令

比如`system('ls')` 则是执行了查看目录的命令(liunx风格)

## str\_replace()

str\_replace()函数是PHP中的一个原生函数，用于替换字符串中的指定字符或子串。该函数的语法如下：

`str_replace($search, search, $replace, $subject);`

其中，\$search表示要被替换的字符或字符串，\$replace表示用来替换的字符或字符串，\$subject表示待处理的原始字符串。该函数的返回值是经过替换后的字符串。需要注意的是，\$search和\$replace都可以是一个字符串或一个数组

eg.

```
<?php $str = "php就是如此的美妙！";
$new_str = str_replace("美妙", "优美", $str);
echo $new_str; //输出：“php就是如此的优美！”
?>
```

## **`eval()`**

eval()是一个内置函数，用于将字符串作为 PHP 代码执行。

```
<?php
$code = 'echo "Hello, World!";';
eval($code); // 输出：Hello, World!
?>
```
