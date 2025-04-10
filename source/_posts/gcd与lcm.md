---
abbrlink: ''
categories: []
date: '2025-04-10T17:46:54.838435+08:00'
tags: []
title: gcd与lcm
updated: '2025-04-10T17:47:47.057+08:00'
---
# gcd与lcm计算代码

```
#includeiostream
using namespace std;
int gcd(int x,int y)
{
if(y==0) return abs(x);
return gcd(y,x%y);
}
int lcm(int x,int y)
{
if(x==0||y==0) return 0;
return abs(x*y)/gcd(x,y);
}
int main()
{
int a,b;
cin>>a>>b;
cout<gcd(a,b)<<endl;
```
