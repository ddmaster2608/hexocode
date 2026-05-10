---
abbrlink: ''
categories:
- - web
date: '2025-04-01T23:27:35.348396+08:00'
tags:
- ctf
- web
title: php伪协议
updated: '2025-04-01T23:43:07.800+08:00'
cover: 'https://files.seeusercontent.com/2026/05/10/c4lD/IMG_20250601_140450_edit_2439832.jpg'
---
常用的伪协议有

php://filter 读取文件源码 （协议可以对打开的数据流进行筛选和过滤,常用于读取文件源码）
php://input 任意代码执行;这种伪协议用于读取原始的 HTTP POST 数据，可以用于处理上传的文件和表单数据。
data://text/plain 任意代码执行
zip:// 配合文件上传开启后门

# php://filter

常见用法：`/?file=php://filter/read=convert.base64-encode/resource=flag.php`

#补充：php://filter
允许访问 PHP 的输入输出流、标准输入输出和错误描述符， 内存中、磁盘备份的临时文件流以及可以操作其他
读取写入文件资源的过滤器
格式为：php://filter / 过滤器(read)| 过滤器(write) / resource= 目标文件
参数：resource=<要过滤的列表>
read=<读列表，设置过滤器>
write=<写列表，设置过滤器>
常见过滤器：
string.xxx(字符过滤器): string.rot13、string.toupper、string.tolower、string.strip\_tags
convert.xxx (转换过滤器):convert.base64、convert.quoted-printable、convert.iconv等等
compression.xxx(压缩过滤):compression.zlib、compression.bzip2、
compression.zlib.deflate、compression.bzip2.compress等等
mcrypt(加密过滤)：PHP 7.1.0起废弃！
应该是转换过滤器中的字符编码被禁止了，字符编码字典更换，爆破字符编码。
常见字符编码：
UCS-4\*
UCS-4BE
UCS-4LE\*
UCS-4LE
UCS-2
UCS-2BE
UCS-2LE
UTF-32\*
UTF-32BE\*
UTF-32LE\*
UTF-16\*
UTF-16BE\*
UTF-16LE\*
UTF-7
UTF7-IMAP
UTF-8\*
ASCII\*
EUC-JP\*
SJIS\*
eucJP-win\*
SJIS-win\*

之前做题还遇到一个

`?filename=php://filter/convert.iconv.编码.编码/resource=index.php`“编码”来源于上方列表

# data://

协议格式: data:资源类型;编码,内容

data://协议通过执行资源类型,使后面的内容当做文件内容来执行,从而造成任意代码执行

`?url=data://text/plain,?php system('id') ?`

ls，cat flag都可以用
