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

#### 数据库、服务器配置
- 使用了config.js和.env文件两种形式进行配置
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
<img width="2559" height="1390" alt="image" src="https://github.com/user-attachments/assets/b75b2a03-1a85-4235-b43c-907cbffc5596" />
<img width="2517" height="903" alt="image" src="https://github.com/user-attachments/assets/d78dc0f6-14fd-4f4e-a285-1e72f5c91671" />


#### 详情页
<img width="2559" height="1028" alt="image" src="https://github.com/user-attachments/assets/bf132ba0-ac93-45a3-83ff-cc6056ce7bce" />
<img width="2554" height="1340" alt="image" src="https://github.com/user-attachments/assets/245e345a-ee92-4772-a2fb-c2cdffaf03b0" />



