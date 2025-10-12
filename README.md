### 已实现功能
#### 搜索首页
- 电话号码模糊搜索
- 起止时间筛选
- 一键清空时间筛选或所有筛选
- 可选每页展示数量的分页，并且可对ID、起止时间、通话时长进行排序
- 可一键下载筛选后的当前展示页或所有页的csv文件
- 对数据库中有bleguuid的进行了转接号码匹配并显示，同步在前端修改其billsec
#### 详情页面
- 返回首页后对原筛选数据进行持久化
- 可下载录音或在线播放
___ 

### 数据库配置
先运行仓库里的sql查询生成表（不要用原来的），然后到server.js里面的数据库配置改成自己的，正常改个user、database、password就ok了。

<img width="795" height="450" alt="43f6c6d5b4e5d5516d87041e7bcfa499" src="https://github.com/user-attachments/assets/7c7765a8-f4ca-49cd-ac3e-8157e0d16ecd" />

### 后端：
根目录下的cdr-backend文件夹是后端，cd到这个文件夹之后node server.js

<img width="903" height="857" alt="c60324da3361388aa4471476c5875082" src="https://github.com/user-attachments/assets/dd45d91b-15ee-4b29-b427-5a6d3d489f81" />
___

### 界面图
#### 首页
<img width="2534" height="1254" alt="image" src="https://github.com/user-attachments/assets/b16187d7-689a-47df-9a81-078730b20e56" />
<img width="2499" height="934" alt="image" src="https://github.com/user-attachments/assets/9da7af20-14e3-4e84-b35b-a72c3beb1f83" />

#### 详情页
<img width="2544" height="1391" alt="image" src="https://github.com/user-attachments/assets/23ab47a3-3a10-49aa-9e67-f61f62941fe4" />
<img width="2496" height="875" alt="image" src="https://github.com/user-attachments/assets/d519b37e-192b-4b3c-9e8b-bd06512f79ec" />


