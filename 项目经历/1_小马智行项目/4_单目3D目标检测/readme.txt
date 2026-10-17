输入：摄像头图像
输出：摄像头出现障碍物的2d/3d box，和属性
方案：摄像头图像经过第一个stage的backbone后接yolo 2d detection, 第二个stage用第一stage的2d box 从backbone feature crop出roi feature作为第二stage的输入，第二stage接head 预测3d box（depth/heading），和遮挡截断等属性
改进点细节：
1.数据增强，图像色彩，flip，crop，resize等
2.预测观察视角代替heading