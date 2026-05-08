---
abbrlink: ''
categories: []
date: '2024-12-24T10:20:52.499508+08:00'
tags: []
title: 自定义sort排序规则
updated: '2024-12-24T10:20:53.752+08:00'
---
# sort排序自定义规则

sort排序默认是递增排序，我们也可以自定义排序规则

## 方法

比如说一个a数组吧 传统排序方法是

`sort(a,a+n);//有n个数`

注意，如果我们用vector定义了数组，则要

`sort(a.begin(),a.end());`

其实，这样写都省略了一个部分

`sort(a,a+n,规则)`省略了后面的“规则”

对于规则，我们可以用一个bool函数自定义

```c++
bool cmp(stu x,stu y)//x,y的类型取决于数组的类型
{
	if(x.are==y.are)
	  return x.num<y.num;//这是处理are相等的情况：按num升序排序
	return x.are>y.are;//这就是根据 are 的值降序了
}
```

这样，我们就可以用这个规则

`sort(a,a+n,cmp);`

爽了
