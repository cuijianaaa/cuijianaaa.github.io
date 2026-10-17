输入：摄像头图像
输出：摄像头出现障碍物的2d box，伪3d box
方案：摄像头图像经过第一个stage的backbone后接yolo 2d detection, 第二个stage用第一stage的2d box 从backbone feature crop出roi feature作为第二stage的输入，第二stage接head 预测伪3d box（竖线，斜线）
改进点细节：
1.数据增强，图像色彩，flip，crop，resize等