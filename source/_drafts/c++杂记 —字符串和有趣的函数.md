---
abbrlink: ''
categories:
- - c++
date: '2024-11-14T22:37:35.664477+08:00'
tags:
- learn
title: c++杂记 —字符串和有趣的函数
updated: '2024-11-14T22:37:35.884+08:00'
---
# 字符串基础

字符串在c++可以定义为字符数组，和string

```
char s[100];
string s;//注意头文件#include<string>的加入
```

## 输入输出

对于字符数组类型，如果我们用scanf和cin输入，会吞掉空格，所以如果有这个特殊需求，就要用gets

c++中，可以使用getsline.cin()

```c++
char s[100];
getsline.cin(s,100);//遇到换行结束输入
```

对于string类型（常用）

```
string s;
getline(cin.s);
```

但string类型不能广义上printf输出

要这样`printf("%s\n", s.c_str());`

## 遍历

```
#include <iostream>
#include <cstdio>
 
using namespace std;
 
int main()
{
	char s[100] = "hello world!";
	for (int i = 0; i < strlen(s); i++)  cout << s[i] << endl;
    for (int i = 0; i < strlen(s); i++)  printf("%c\n", s[i]);  //注意这里的时间复杂度O[n*n],可以定义一个len来接收strlen
	for (int i = 0; s[i]; i++)  cout << s[i] << endl;           //时间复杂度O[n]
	for (int i = 0; s[i]; i++)  printf("%c\n", s[i]);
 
	return 0;
}

```

当然也可以使用：变量名.size() 这样就不会出现strline的for内时间复杂度增加的情况

当然也可以基于for遍历

```
for (char c : s)  cout << c << endl;
```

# 有趣的函数

1.stoi：将数字字符转换为十进制数字

2.isdigit：判断是否为数字字符，c++中要加头文件 cctype ,c是cctype.h

3 变量名.empty():判断字符串是否为空

4.变量名.clear()：清空字符串

实操：

题目要求，把字符串中数字相加

比如w123ww23w1w

则得到123+23+1=147

```
#include <iostream>
#include <string>
#include <cctype>
using namespace std;
int main() {
    string input;
    getline(cin, input);
    int sum = 0;
    string numberBuffer; 
    for (char c:input) {
        if (isdigit(c)) { 
            numberBuffer += c;
        } else if (!isdigit(c)&&!numberBuffer.empty()) { 
            sum+=stoi(numberBuffer); 
            numberBuffer.clear(); 
        }
    }
    cout<<sum<<endl;
    return 0;
}
```
