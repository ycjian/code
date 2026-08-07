# PyTorch 练习题与答案：从张量基础到 LLM 对齐

## 01. Implement ReLU

**Problem.** Implement `ReLU(x) = max(0, x)` without built-in activation functions. Autograd must still work.

**中文题意。** 不使用 `torch.relu`、`F.relu` 或 `clamp`，从零实现 ReLU。输入为正数时保留原值，否则输出 0，并且梯度必须能正常反向传播。

### Reviewed Solution

#### 数学、公式与算法思路

$$
y_i=\max(0,x_i)
$$

- **公式 / 不变量。** ReLU 对每个元素独立截断负值；除零点外，导数为 $\mathbf{1}[x_i>0]$。
- **算法拆解。** 逐元素比较输入与 0，再选择原值或 0；时间复杂度 O(N)，额外空间取决于输出张量。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def relu(x: torch.Tensor) -> torch.Tensor:
# [变化示例] 调用该单行函数时：执行状态：调用 torch.Tensor) -> torch.Tensor: 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    # 条件成立时选择 x，否则选择与 x 同设备、同 dtype 的 0
    # 图示：[-2, 0, 3] -> [0, 0, 3]
    return torch.where(x > 0, x, torch.zeros_like(x))
    # [变化示例] 函数内部：按条件逐元素选择；例如 x=[-2,0,3]、条件 x>0 -> [0,0,3] -> 调用方收到该输出。
```

**中文解释。** `torch.where` 只在条件选中的分支上传递梯度。`zeros_like` 保证输出不会意外改变 dtype 或 device。在 `x=0` 处数学导数不存在，这里选择梯度 0，与 PyTorch ReLU 一致。

#### 代码/API 逐项解释

- `torch.Tensor`：PyTorch 张量类型；它同时记录数值、shape、dtype、device，并可通过 `requires_grad=True` 接入 autograd 计算图。
- `torch.where`：逐元素条件选择：`torch.where(condition, a, b)` 在条件为 True 的位置取 `a`，否则取 `b`；三者需满足 broadcasting 规则。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。

#### 输入与输出示例

- **输入/调用**：输入 `x=tensor([-2.,0.,3.])`，`x>0` 得到 `[False,False,True]`；输出 `tensor([0.,0.,3.])`，shape 和 dtype 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 02. Numerically Stable Softmax

**Problem.** Implement softmax along an arbitrary dimension without built-in softmax, and make it numerically stable.

**中文题意。** 沿指定维度实现 Softmax，不能调用内置 Softmax。必须先减去最大值，避免大 logits 在指数运算时溢出。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p_i=\frac{e^{x_i-m}}{\sum_j e^{x_j-m}},\qquad m=\max_j x_j
$$

- **公式 / 不变量。** 减去同一常数不改变 Softmax 比值；取最大值作平移后，最大指数仅为 1。
- **算法拆解。** 沿目标维求最大值并保留维度，平移后指数化、求和、归一化；复杂度 O(N)，重点是避免 overflow。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def my_softmax(x: torch.Tensor, dim: int = -1) -> torch.Tensor:
# [变化示例] 调用该单行函数时：torch.Tensor, dim: int=未定义/旧值 -> torch.Tensor, dim: int=-1) -> torch.Tensor:；这是一次重新绑定/状态更新，右侧值决定新状态。
    # 每一行减去自己的最大值；概率不变，但 exp 更稳定
    shifted = x - x.amax(dim=dim, keepdim=True)
    # [变化示例] shifted=未定义/旧值 -> shifted=输入减去目标维最大值；例如 [1000,1001] -> [-1,0]。
    exp_x = shifted.exp()
    # [变化示例] exp_x=未定义/旧值 -> exp_x=逐元素指数；例如 [0,1] -> [1,2.718]。
    # keepdim=True 使分母可以广播回原 tensor
    return exp_x / exp_x.sum(dim=dim, keepdim=True)
    # [变化示例] 函数内部：exp_x / exp_x.sum(dim=dim, keepdim=True)；数值示例：6 / 3 -> 2 -> 调用方收到该输出。
```

**中文解释。** 同时减去常数不会改变 Softmax，因为分子与分母中的公共因子会抵消。最大元素变成 0，因此最大的指数值是 1，可避免 `exp(1000)` 产生无穷大。

#### 代码/API 逐项解释

- `torch.Tensor`：PyTorch 张量类型；它同时记录数值、shape、dtype、device，并可通过 `requires_grad=True` 接入 autograd 计算图。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入 `x=tensor([1000.,1001.])`；先减最大值变成 `[-1,0]`，输出约 `[0.2689,0.7311]`，总和为 1 且不会计算 `exp(1001)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 03. Simple Linear Layer

**Problem.** Implement `y = xW^T + b`. Weight shape is `(out_features, in_features)` and both tensors require gradients.

**中文题意。** 手写全连接层。权重形状为 `(输出维度, 输入维度)`，偏置为 `(输出维度,)`，两者都需要梯度。

### Reviewed Solution

#### 数学、公式与算法思路

$$
Y=XW^\top+b,\quad X\in\mathbb{R}^{B\times D_{in}},\ W\in\mathbb{R}^{D_{out}\times D_{in}}
$$

- **公式 / 不变量。** 线性层把最后一维从输入特征映射到输出特征；偏置按前导维广播。
- **算法拆解。** 先确认矩阵收缩维一致，再做矩阵乘法并加偏置；计算量 O(BD_{in}D_{out})。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class SimpleLinear:
    def __init__(self, in_features: int, out_features: int):
        # 缩放初始化，避免输入维度增大时输出方差过大
        scale = 1.0 / math.sqrt(in_features)
        # [变化示例] scale=未定义/旧值 -> scale=1.0 / math.sqrt(in_features)；数值示例：6 / 3 -> 2。
        self.weight = (
            torch.randn(out_features, in_features) * scale
        ).requires_grad_()
        # [变化示例] self.weight=未定义/旧值 -> self.weight=计算得到的张量并开启梯度追踪；例如参数 shape 保持不变，requires_grad False -> True。
        self.bias = torch.zeros(out_features, requires_grad=True)
        # [变化示例] self.bias=未定义/旧值 -> self.bias=全 0 张量；shape 由 out_features 指定。

    def forward(self, x: torch.Tensor) -> torch.Tensor:
    # [变化示例] 调用该单行函数时：执行状态：调用 torch.Tensor) -> torch.Tensor: 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        # (..., Din) @ (Din, Dout) + (Dout,) -> (..., Dout)
        return x @ self.weight.T + self.bias
        # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。
```

**中文解释。** `weight.T` 把权重变成 `(Din,Dout)` 以便矩阵乘法。偏置会自动广播到 batch 和其他前导维度。生产代码通常继承 `nn.Module` 并使用 `nn.Parameter`，这样优化器能自动发现参数。

#### 代码/API 逐项解释

- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- `torch.Tensor`：PyTorch 张量类型；它同时记录数值、shape、dtype、device，并可通过 `requires_grad=True` 接入 autograd 计算图。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.requires_grad_(...)`：`.requires_grad_(True)` 原地设置是否追踪梯度；只对浮点/复数张量有效。

#### 输入与输出示例

- **输入/调用**：输入 `x.shape=(2,3)`、`weight.shape=(4,3)`、`bias.shape=(4,)`；`x @ weight.T + bias` 输出 shape `(2,4)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 04. LayerNorm

**Problem.** Normalize over the last dimension, then apply learned scale `gamma` and shift `beta`.

**中文题意。** 对每个样本的最后一个维度计算均值和方差，标准化后乘以 `gamma`、加上 `beta`。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\hat{x}_i=\frac{x_i-\mu}{\sqrt{\sigma^2+\epsilon}},\qquad y_i=\gamma_i\hat{x}_i+\beta_i
$$

- **公式 / 不变量。** LayerNorm 在每个样本或 token 的特征维内归一化，不依赖 batch 中其他样本。
- **算法拆解。** 沿最后一维求总体均值和方差，标准化后做逐特征仿射变换；epsilon 防止零方差除零。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def my_layer_norm(x, gamma, beta, eps=1e-5):
    # (B,S,D) -> 均值和方差形状都是 (B,S,1)
    mean = x.mean(dim=-1, keepdim=True)
    # [变化示例] mean=未定义/旧值 -> mean=沿指定维求均值；例如 [1,2,3] -> 2。
    var = x.var(dim=-1, keepdim=True, unbiased=False)
    # [变化示例] var=未定义/旧值 -> var=方差；例如 [1,2,3] 的总体方差 -> 2/3。
    normalized = (x - mean) * torch.rsqrt(var + eps)
    # [变化示例] normalized=未定义/旧值 -> normalized=(x - mean) * torch.rsqrt(var + eps)；数值示例：2 * 3 -> 6。
    # gamma/beta 的 (D,) 自动广播到所有 token
    return normalized * gamma + beta
    # [变化示例] 函数内部：normalized * gamma + beta；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** LayerNorm 对每个 token 独立归一化，不依赖 batch 中其他样本。必须使用总体方差 `unbiased=False`。`eps` 防止方差为 0 时除零。

#### 代码/API 逐项解释

- `torch.rsqrt`：计算 `1/sqrt(x)`；归一化中写成乘法 `x * rsqrt(var+eps)`，通常比先 sqrt 再除更直接。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.var(...)`：`.var(..., correction=0)` 计算总体方差；LayerNorm/BatchNorm forward 的方差约定必须核对。

#### 输入与输出示例

- **输入/调用**：输入单个 token `x=[1.,2.,3.]`、`gamma=[1,1,1]`、`beta=[0,0,0]`；输出均值约 0、方差约 1，shape 仍为 `(3,)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 05. Scaled Dot-Product Attention

**Problem.** Compute `softmax(QK^T / sqrt(Dk))V`, including cross-attention where query and key lengths differ.

**中文题意。** 实现缩放点积注意力，并支持 `Sq != Sk` 的交叉注意力。Q/K 的特征维必须相同，K/V 的序列长度必须相同。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
$$

- **公式 / 不变量。** 点积衡量 query 与 key 的相关性；除以 $\sqrt{d_k}$ 控制 logits 方差，Softmax 后对 value 加权。
- **算法拆解。** 先算所有 Q-K 分数，再按 key 维归一化并乘 V；标准复杂度 O(S_qS_kd)。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def scaled_dot_product_attention(Q, K, V):
    if Q.size(-1) != K.size(-1) or K.size(1) != V.size(1):
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("incompatible Q, K, V shapes")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    # 先计算每个 query 与所有 keys 的相似度
    # (B,Sq,Dk) @ (B,Dk,Sk) -> (B,Sq,Sk)
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(Q.size(-1))
    # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    weights = torch.softmax(scores, dim=-1)
    # [变化示例] weights=未定义/旧值 -> weights=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    # (B,Sq,Sk) @ (B,Sk,Dv) -> (B,Sq,Dv)
    return torch.bmm(weights, V)
    # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。
```

**中文解释。** `QK^T` 衡量每个 query 与每个 key 的相似度。除以 `sqrt(Dk)` 可控制点积分布的方差，避免 Softmax 过早饱和。最后用注意力概率对 V 做加权求和。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：若 `Q:(2,4,8)`、`K:(2,6,8)`、`V:(2,6,16)`，scores 为 `(2,4,6)`，最终输出为 `(2,4,16)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 06. Multi-Head Attention

**Problem.** Project Q/K/V, split them into heads, run attention per head, concatenate, and apply an output projection.

**中文题意。** 实现多头注意力：先线性投影，再拆成多个 head，每个 head 独立计算注意力，最后拼接并输出投影。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{MHA}(X)=\operatorname{Concat}(head_1,\ldots,head_H)W_O
$$

- **公式 / 不变量。** 每个 head 在较低维子空间独立做注意力，拼接后通过输出投影混合 head 信息。
- **算法拆解。** Q/K/V 投影后 reshape 为 H 个 head，批量注意力，再转回并投影；注意 transpose 后常需 contiguous 或 reshape。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if d_model % num_heads:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("d_model must be divisible by num_heads")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.num_heads = num_heads
        # [变化示例] self.num_heads=未定义/旧值 -> self.num_heads=num_heads；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.d_head = d_model // num_heads
        # [变化示例] self.d_head=未定义/旧值 -> self.d_head=d_model // num_heads；数值示例：7 // 3 -> 2。
        self.W_q = nn.Linear(d_model, d_model)
        # [变化示例] self.W_q=未定义/旧值 -> self.W_q=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.W_k = nn.Linear(d_model, d_model)
        # [变化示例] self.W_k=未定义/旧值 -> self.W_k=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.W_v = nn.Linear(d_model, d_model)
        # [变化示例] self.W_v=未定义/旧值 -> self.W_v=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.W_o = nn.Linear(d_model, d_model)
        # [变化示例] self.W_o=未定义/旧值 -> self.W_o=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。

    def _split(self, x):
        b, s, _ = x.shape
        # [变化示例] b, s, _=未定义/旧值 -> b, s, _=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        # (B,S,D) -> (B,S,H,Dh) -> (B,H,S,Dh)
        return x.view(b, s, self.num_heads, self.d_head).transpose(1, 2)
        # [变化示例] 函数内部：result 重排为 b, s, self.num_heads, self.d_head；元素数量与顺序保持不变（若布局允许则共享 storage） -> 调用方收到该输出。

    def forward(self, Q, K, V):
        q = self._split(self.W_q(Q))
        # [变化示例] q=未定义/旧值 -> q 接收 self._split(self.W_q(Q)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        k = self._split(self.W_k(K))
        # [变化示例] k=未定义/旧值 -> k 接收 self._split(self.W_k(K)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        v = self._split(self.W_v(V))
        # [变化示例] v=未定义/旧值 -> v 接收 self._split(self.W_v(V)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.d_head)
        # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        context = torch.softmax(scores, dim=-1) @ v
        # [变化示例] context=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 context；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        b, _, sq, _ = context.shape
        # [变化示例] b, _, sq, _=未定义/旧值 -> b, _, sq, _=context.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        # (B,H,Sq,Dh) -> (B,Sq,D)，contiguous 后才能安全 view
        merged = context.transpose(1, 2).contiguous().view(b, sq, -1)
        # [变化示例] merged=未定义/旧值 -> merged 的轴按 1, 2 重排；例如 (B,S,D) 交换后可变为 (B,D,S)，数值不复制。
        return self.W_o(merged)
        # [变化示例] 函数内部：执行 self.W_o(merged) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 多头机制让不同 head 学习不同的关系子空间。拆头后分数形状是 `(B,H,Sq,Sk)`。`transpose` 改变 stride，因此拼接前使用 `contiguous()`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 `x.shape=(B=2,S=5,D=16)`、`num_heads=4`；拆头后为 `(2,4,5,4)`，合头后输出回到 `(2,5,16)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 07. BatchNorm

**Problem.** Normalize `(N,D)` over the batch dimension and maintain running statistics for inference.

**中文题意。** 训练时按 batch 维度计算每个特征的均值和方差，同时更新运行统计量；推理时只使用运行统计量。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\hat{x}_{n,c}=\frac{x_{n,c}-\mu_c}{\sqrt{\sigma_c^2+\epsilon}},\qquad y_{n,c}=\gamma_c\hat{x}_{n,c}+\beta_c
$$

- **公式 / 不变量。** BatchNorm 按通道聚合 batch 及空间位置；训练用当前统计量，推理用移动平均。
- **算法拆解。** 训练时求通道均值方差并更新 running stats，推理时固定统计量；小 batch 会使估计噪声增大。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def my_batch_norm(x, gamma, beta, running_mean, running_var,
                  eps=1e-5, momentum=0.1, training=True):
    if training:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        # 对 N 个样本统计每个特征，结果形状为 (D,)
        mean = x.mean(dim=0)
        # [变化示例] mean=未定义/旧值 -> mean=沿指定维求均值；例如 [1,2,3] -> 2。
        var = x.var(dim=0, correction=0)  # forward 使用有偏总体方差
        # [变化示例] var=未定义/旧值 -> var=方差；例如 [1,2,3] 的总体方差 -> 2/3。
        running_var_sample = x.var(dim=0, correction=1)  # running_var 使用无偏样本方差
        # [变化示例] running_var_sample=未定义/旧值 -> running_var_sample=方差；例如 [1,2,3] 的无偏样本方差 -> 1。
        with torch.no_grad():
            # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
            # running = (1-m)*running + m*batch_stat
            running_mean.lerp_(mean, momentum)
            # [变化示例] 执行状态：调用 running_mean.lerp_(mean, momentum) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
            running_var.lerp_(running_var_sample, momentum)
            # [变化示例] 执行状态：调用 running_var.lerp_(running_var_sample, momentum) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    else:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        mean, var = running_mean, running_var
        # [变化示例] mean, var=未定义/旧值 -> mean, var=tuple (running_mean, running_var)；多个值按位置传递/解包，元素本身不被复制。
    return gamma * (x - mean) * torch.rsqrt(var + eps) + beta
    # [变化示例] 函数内部：gamma * (x - mean) * torch.rsqrt(var + eps) + beta；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** BatchNorm 让同一特征在当前 batch 中标准化。PyTorch 的精确语义是：训练输出使用 `correction=0` 的有偏方差，但 `running_var` 更新使用 `correction=1` 的无偏方差。原 notebook 把同一个有偏方差用于两处，因此不能与 `nn.BatchNorm1d` 的状态完全对齐；这里已修正。训练时每个特征必须有多于一个统计值，否则无偏方差无定义。

#### 代码/API 逐项解释

- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `torch.rsqrt`：计算 `1/sqrt(x)`；归一化中写成乘法 `x * rsqrt(var+eps)`，通常比先 sqrt 再除更直接。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.var(...)`：`.var(..., correction=0)` 计算总体方差；LayerNorm/BatchNorm forward 的方差约定必须核对。

- `.lerp_(...)`：`.lerp_(end,weight)` 原地线性插值；可把 moving average 更新写成稳定的一次操作。

#### 输入与输出示例

- **输入/调用**：输入训练 batch `x.shape=(8,3,32,32)`；每个 channel 在 `(B,H,W)` 上统计，输出同 shape，并更新长度 3 的 running mean/var。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 08. RMSNorm

**Problem.** Normalize by root-mean-square over the last dimension without subtracting the mean.

**中文题意。** 在最后一维计算均方根并归一化，但不像 LayerNorm 那样减均值。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{RMSNorm}(x)=\gamma\odot\frac{x}{\sqrt{\frac1D\sum_{i=1}^{D}x_i^2+\epsilon}}
$$

- **公式 / 不变量。** RMSNorm 不减均值，只按均方根缩放，因此比 LayerNorm 少一次中心化。
- **算法拆解。** 求最后一维平方均值，乘倒平方根，再乘可学习缩放；复杂度 O(ND)。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def rms_norm(x, weight, eps=1e-6):
    # RMS = sqrt(mean(x^2) + eps)，形状保留为 (...,1)
    inv_rms = torch.rsqrt(x.square().mean(dim=-1, keepdim=True) + eps)
    # [变化示例] inv_rms=未定义/旧值 -> inv_rms=倒平方根；例如 [1,4] -> [1,0.5]。
    return x * inv_rms * weight
    # [变化示例] 函数内部：x * inv_rms * weight；数值示例：2 * 3 -> 6 -> 调用方收到该输出。
```

**中文解释。** RMSNorm 只控制向量尺度，不改变中心位置，计算量比 LayerNorm 小。`weight` 对最后一维逐元素缩放。

#### 代码/API 逐项解释

- `torch.rsqrt`：计算 `1/sqrt(x)`；归一化中写成乘法 `x * rsqrt(var+eps)`，通常比先 sqrt 再除更直接。
- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：输入 `x=[3.,4.]`、`weight=[1.,1.]`；RMS=`sqrt((9+16)/2)`，输出约 `[0.8485,1.1314]`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 09. Causal Self-Attention

**Problem.** Prevent token position `i` from attending to future positions `j > i`.

**中文题意。** 实现 GPT 解码器中的因果注意力。第 `i` 个 token 只能看见自己和之前的 token，不能泄露未来信息。

### Reviewed Solution

#### 数学、公式与算法思路

$$
A=\operatorname{softmax}\!\left(\frac{QK^\top}{\sqrt d}+M\right),\quad M_{ij}=\begin{cases}0&j\le i\\-\infty&j>i\end{cases}
$$

- **公式 / 不变量。** 因果 mask 让位置 i 只能读取当前位置及过去，避免训练时泄漏未来 token。
- **算法拆解。** 生成上三角布尔 mask，在 Softmax 前把未来 logits 置为负无穷，再乘 V；mask 必须与序列维对齐。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def causal_attention(Q, K, V):
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(Q.size(-1))
    # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    s = Q.size(1)
    # [变化示例] s=未定义/旧值 -> s=指定轴长度；例如 shape=(2,3,4)，size(1) -> 3。
    # 上三角 j>i 为 True：未来位置全部屏蔽
    future = torch.triu(
        torch.ones(s, s, dtype=torch.bool, device=Q.device), diagonal=1
    )
    # [变化示例] future=未定义/旧值 -> future=上三角部分；例如 3x3 全 1 且 diagonal=1 -> 仅严格上三角为 1。
    scores = scores.masked_fill(future, float("-inf"))
    # [变化示例] scores=未定义/旧值 -> scores=mask 后张量；例如 values=[1,2]、mask=[False,True]、fill=-inf -> [1,-inf]。
    # exp(-inf)=0，所以未来 token 的注意力概率为 0
    return torch.bmm(torch.softmax(scores, dim=-1), V)
    # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。
```

**中文解释。** Mask 必须在 Softmax 之前应用。第一行只有位置 0 可见，因此它的输出等于 `V[:,0]`。这是自注意力版本，默认 Q/K/V 序列长度一致。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.triu`：保留矩阵上三角；`diagonal=1` 可标出严格未来位置，用于 causal mask。
- `torch.ones`：创建指定 shape 的全 1 张量，常作为 mask 的原始矩阵或正标签。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 `Q,K,V.shape=(1,4,8)`；位置 0 的概率只能落在 key 0，位置 3 可看 key 0..3，输出 shape `(1,4,8)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 10. Grouped Query Attention

**Problem.** Use fewer key/value heads than query heads, sharing each KV head across a group of query heads.

**中文题意。** 实现 GQA：query 保留完整 head 数，而 K/V 使用更少的 head，并在一组 query heads 之间共享，以减少 KV cache。

### Reviewed Solution

#### 数学、公式与算法思路

$$
H_q=gH_{kv},\qquad h_{kv}=\left\lfloor\frac{h_q}{g}\right\rfloor
$$

- **公式 / 不变量。** GQA 让多组 query head 共享较少的 key/value head，在质量与 KV cache 内存之间折中。
- **算法拆解。** 验证 query head 数可被 KV head 数整除，把 K/V 按组扩展或用分组索引，再执行普通多头注意力。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class GroupQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads, num_kv_heads):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if d_model % num_heads or num_heads % num_kv_heads:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("invalid head configuration")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.h, self.h_kv = num_heads, num_kv_heads
        # [变化示例] self.h, self.h_kv=未定义/旧值 -> self.h, self.h_kv=tuple (num_heads, num_kv_heads)；多个值按位置传递/解包，元素本身不被复制。
        self.dh = d_model // num_heads
        # [变化示例] self.dh=未定义/旧值 -> self.dh=d_model // num_heads；数值示例：7 // 3 -> 2。
        self.W_q = nn.Linear(d_model, d_model)
        # [变化示例] self.W_q=未定义/旧值 -> self.W_q=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.W_k = nn.Linear(d_model, num_kv_heads * self.dh)
        # [变化示例] self.W_k=未定义/旧值 -> self.W_k=线性映射模块；输入最后一维 d_model -> 输出最后一维 num_kv_heads * self.dh。
        self.W_v = nn.Linear(d_model, num_kv_heads * self.dh)
        # [变化示例] self.W_v=未定义/旧值 -> self.W_v=线性映射模块；输入最后一维 d_model -> 输出最后一维 num_kv_heads * self.dh。
        self.W_o = nn.Linear(d_model, d_model)
        # [变化示例] self.W_o=未定义/旧值 -> self.W_o=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。

    def forward(self, x):
        b, s, _ = x.shape
        # [变化示例] b, s, _=未定义/旧值 -> b, s, _=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        q = self.W_q(x).view(b, s, self.h, self.dh).transpose(1, 2)
        # [变化示例] q=未定义/旧值 -> q=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        k = self.W_k(x).view(b, s, self.h_kv, self.dh).transpose(1, 2)
        # [变化示例] k=未定义/旧值 -> k=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        v = self.W_v(x).view(b, s, self.h_kv, self.dh).transpose(1, 2)
        # [变化示例] v=未定义/旧值 -> v=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        # 例：8 个 Q heads / 2 个 KV heads -> 每个 KV head 复制 4 次
        repeats = self.h // self.h_kv
        # [变化示例] repeats=未定义/旧值 -> repeats=self.h // self.h_kv；数值示例：7 // 3 -> 2。
        k = k.repeat_interleave(repeats, dim=1)
        # [变化示例] k=未定义/旧值 -> k=沿指定轴重复；例如 head 轴 H=2、repeats=3 -> H=6。
        v = v.repeat_interleave(repeats, dim=1)
        # [变化示例] v=未定义/旧值 -> v=沿指定轴重复；例如 head 轴 H=2、repeats=3 -> H=6。
        attn = torch.softmax(q @ k.transpose(-2, -1) / math.sqrt(self.dh), -1) @ v
        # [变化示例] attn=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 attn；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        return self.W_o(attn.transpose(1, 2).contiguous().view(b, s, -1))
        # [变化示例] 函数内部：执行 self.W_o(attn.transpose(1, 2).contiguous().view(b, s, -1)) 得到结果 -> 调用方收到该输出。
```

**中文解释。** GQA 的 K/V 参数量和 cache 大约缩小为 `Hkv/H`。当 `Hkv=H` 时退化为普通 MHA；当 `Hkv=1` 时接近 Multi-Query Attention。原题未要求 causal mask，真正的 decoder 还需加 mask。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.repeat_interleave(...)`：`.repeat_interleave(r, dim)` 真正复制元素；GQA 用它把每个 KV head 对应到多个 Q heads。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。

#### 输入与输出示例

- **输入/调用**：`B=2,S=5,D=16,Hq=4,Hkv=2` 时，每个 KV head 复制服务 2 个 query heads；输出 `(2,5,16)`，cache 只保存 2 个 KV heads。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 11. Sliding Window Attention

**Problem.** Position `i` may attend only to positions satisfying `|i-j| <= window_size`.

**中文题意。** 每个 token 只能关注左右窗口内的 token；窗口为 0 时只看自己，窗口覆盖全序列时等价于完整注意力。

### Reviewed Solution

#### 数学、公式与算法思路

$$
M_{ij}=0\ \text{iff}\ |i-j|\le w\ \text{and causal constraints hold}
$$

- **公式 / 不变量。** 滑动窗口只保留局部邻域连接，把全局二次注意力改为近似线性规模。
- **算法拆解。** 构造局部可见性 mask，仅对窗口内 key 归一化；理论连接数 O(Sw)，但显式 S×S mask 仍占 O(S^2) 内存。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def sliding_window_attention(Q, K, V, window_size):
    if window_size < 0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("window_size must be non-negative")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(Q.size(-1))
    # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    s = Q.size(1)
    # [变化示例] s=未定义/旧值 -> s=指定轴长度；例如 shape=(2,3,4)，size(1) -> 3。
    pos = torch.arange(s, device=Q.device)
    # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(s, device=Q.device)；例如 arange(4) 为 [0,1,2,3]。
    # 距离超过 w 的格子为 True，例如 w=1 时每行最多看 3 个位置
    outside = (pos[:, None] - pos[None, :]).abs() > window_size
    # [变化示例] outside=未定义/旧值 -> outside 接收 (pos[:, None] - pos[None, :]).abs() > window_size 的返回值；用 shape/dtype/device 与示例输入核对变化。
    weights = torch.softmax(scores.masked_fill(outside, float("-inf")), -1)
    # [变化示例] weights=未定义/旧值 -> weights=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    return torch.bmm(weights, V)
    # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。
```

**中文解释。** 该答案在数值上正确，但仍创建了完整的 `S x S` 分数矩阵，所以只是教学用 masking，并没有获得真正稀疏实现的 `O(Sw)` 内存优势。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：序列长度 6、窗口 2 时，位置 3 只允许关注位置 1..5（若是双向窗口）；函数输出 shape 与 Q 相同。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 12. Linear Attention

**Problem.** Use `phi(x)=ELU(x)+1` and reassociate matrix products to avoid creating an `S x S` matrix.

**中文题意。** 用非负核特征映射替代 Softmax，并先计算 `K^T V`，将序列平方复杂度改为与序列长度线性相关。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{LinearAttn}(Q,K,V)=\phi(Q)\bigl(\phi(K)^\top V\bigr)
$$

- **公式 / 不变量。** 利用结合律先聚合 K 与 V，避免显式形成 S×S 注意力矩阵；核映射必须保持非负或满足所选近似。
- **算法拆解。** 先计算 KV 汇总，再与每个 Q 相乘并做归一化；典型复杂度从 O(S^2d) 降到 O(Sd^2)。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def linear_attention(Q, K, V, eps=1e-6):
    q, k = F.elu(Q) + 1.0, F.elu(K) + 1.0
    # [变化示例] q, k=未定义/旧值 -> q, k=ELU(input)+1；例如 [-1,0,1] -> 约 [0.368,1,2]，结果保持为正。
    # (B,Dk,S) @ (B,S,Dv) -> (B,Dk,Dv)，不创建 SxS
    kv = torch.bmm(k.transpose(1, 2), V)
    # [变化示例] kv=未定义/旧值 -> kv=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    numerator = torch.bmm(q, kv)
    # [变化示例] numerator=未定义/旧值 -> numerator=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    denominator = torch.bmm(q, k.sum(1, keepdim=True).transpose(1, 2))
    # [变化示例] denominator=未定义/旧值 -> denominator=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    return numerator / denominator.clamp_min(eps)
    # [变化示例] 函数内部：numerator / denominator.clamp_min(eps)；数值示例：6 / 3 -> 2 -> 调用方收到该输出。
```

**中文解释。** 通过矩阵乘法结合律先聚合 K/V，可避免完整注意力矩阵。它不是 Softmax attention 的严格等价实现，而是一种具有不同归纳偏置的核近似。

#### 代码/API 逐项解释

- `F.elu`：ELU 激活：正区间近似恒等，负区间平滑饱和；在线性 attention 中常加 1 使特征映射为正。
- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

#### 输入与输出示例

- **输入/调用**：输入 `Q,K,V.shape=(2,128,32)`；先算 `K^T V:(2,32,32)`，再与 Q 相乘，避免创建 `(2,128,128)` scores。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 13. GPT-2 Transformer Block

**Problem.** Build a pre-norm causal Transformer block with residual attention and a 4x GELU MLP.

**中文题意。** 实现简化 GPT-2 block：`x += causal_attention(LN(x))`，然后 `x += MLP(LN(x))`。

### Reviewed Solution

#### 数学、公式与算法思路

$$
X'=X+\operatorname{Attn}(\operatorname{LN}(X)),\qquad Y=X'+\operatorname{MLP}(\operatorname{LN}(X'))
$$

- **公式 / 不变量。** Pre-LN Transformer 用残差路径保持梯度通道，注意力负责 token 混合，MLP 负责通道混合。
- **算法拆解。** 依次执行归一化、注意力、残差，再归一化、MLP、残差；每个子层输入输出 shape 必须一致。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class GPT2Block(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if d_model % num_heads:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("d_model must be divisible by num_heads")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.h, self.dh = num_heads, d_model // num_heads
        # [变化示例] self.h, self.dh=未定义/旧值 -> self.h, self.dh=tuple (num_heads, d_model // num_heads)；多个值按位置传递/解包，元素本身不被复制。
        self.ln1, self.ln2 = nn.LayerNorm(d_model), nn.LayerNorm(d_model)
        # [变化示例] self.ln1, self.ln2=未定义/旧值 -> self.ln1, self.ln2=LayerNorm 模块；例如输入 (...,D) -> 输出仍为 (...,D)，最后一维被归一化。
        self.q, self.k = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        # [变化示例] self.q, self.k=未定义/旧值 -> self.q, self.k=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.v, self.o = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        # [变化示例] self.v, self.o=未定义/旧值 -> self.v, self.o=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.mlp = nn.Sequential(
            nn.Linear(d_model, 4*d_model), nn.GELU(), nn.Linear(4*d_model, d_model)
        )
        # [变化示例] self.mlp=未定义/旧值 -> self.mlp=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。

    def _attention(self, x):
        b, s, _ = x.shape
        # [变化示例] b, s, _=未定义/旧值 -> b, s, _=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        split = lambda z: z.view(b, s, self.h, self.dh).transpose(1, 2)
        # [变化示例] split=未定义/旧值 -> split=可调用函数；例如传入 z 后，按 z: z.view(b, s, self.h, self.dh).transpose(1, 2) 生成输出。
        q, k, v = split(self.q(x)), split(self.k(x)), split(self.v(x))
        # [变化示例] q, k, v=未定义/旧值 -> q, k, v 接收 split(self.q(x)), split(self.k(x)), split(self.v(x)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.dh)
        # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        future = torch.triu(torch.ones(s, s, dtype=torch.bool, device=x.device), 1)
        # [变化示例] future=未定义/旧值 -> future=上三角部分；例如 3x3 全 1 且 diagonal=1 -> 仅严格上三角为 1。
        ctx = torch.softmax(scores.masked_fill(future, float("-inf")), -1) @ v
        # [变化示例] ctx=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 ctx；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        return self.o(ctx.transpose(1, 2).contiguous().view(b, s, -1))
        # [变化示例] 函数内部：执行 self.o(ctx.transpose(1, 2).contiguous().view(b, s, -1)) 得到结果 -> 调用方收到该输出。

    def forward(self, x):
        # Pre-Norm + 两条 residual 路径
        x = x + self._attention(self.ln1(x))
        # [变化示例] x=未定义/旧值 -> x=x + self._attention(self.ln1(x))；数值示例：2 + 3 -> 5。
        return x + self.mlp(self.ln2(x))
        # [变化示例] 函数内部：x + self.mlp(self.ln2(x))；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** Pre-Norm 让 residual stream 保持直接梯度路径，深层训练通常更稳定。注意力负责 token 间信息交换，MLP 负责每个 token 内的非线性特征变换。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.LayerNorm`：对每个样本最后若干维独立归一化，训练和推理均使用当前输入统计。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.GELU`：平滑门控激活，近似用输入乘以高斯分布 CDF；Transformer MLP 常用。
- `torch.triu`：保留矩阵上三角；`diagonal=1` 可标出严格未来位置，用于 causal mask。
- `torch.ones`：创建指定 shape 的全 1 张量，常作为 mask 的原始矩阵或正标签。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 hidden states `(B=2,S=8,D=64)`，attention 和 MLP 两条 residual 都保持 shape，block 输出仍是 `(2,8,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 14. KV Cache Attention

**Problem.** Cache projected K/V tensors so autoregressive decoding projects only new tokens.

**中文题意。** 预填充时保存所有 K/V；逐 token 解码时，把新 K/V 拼到缓存后面，避免重复投影历史 token。

### Reviewed Solution

#### 数学、公式与算法思路

$$
K_{cache}^{(t)}=[K_{cache}^{(t-1)};K_t],\qquad V_{cache}^{(t)}=[V_{cache}^{(t-1)};V_t]
$$

- **公式 / 不变量。** 自回归解码只为新 token 计算 K/V，并复用历史缓存，避免重复编码整个前缀。
- **算法拆解。** 追加新 K/V，令当前 Q 读取完整 cache；单步注意力 O(td)，总解码仍约 O(T^2d)，但投影不再重复。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class KVCacheAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if d_model % num_heads:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("invalid head count")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.h, self.dh = num_heads, d_model // num_heads
        # [变化示例] self.h, self.dh=未定义/旧值 -> self.h, self.dh=tuple (num_heads, d_model // num_heads)；多个值按位置传递/解包，元素本身不被复制。
        self.q, self.k = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        # [变化示例] self.q, self.k=未定义/旧值 -> self.q, self.k=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.v, self.o = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        # [变化示例] self.v, self.o=未定义/旧值 -> self.v, self.o=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。

    def forward(self, x, cache=None):
        b, s_new, _ = x.shape
        # [变化示例] b, s_new, _=未定义/旧值 -> b, s_new, _=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        split = lambda z: z.view(b, s_new, self.h, self.dh).transpose(1, 2)
        # [变化示例] split=未定义/旧值 -> split=可调用函数；例如传入 z 后，按 z: z.view(b, s_new, self.h, self.dh).transpose(1, 2) 生成输出。
        q, k_new, v_new = split(self.q(x)), split(self.k(x)), split(self.v(x))
        # [变化示例] q, k_new, v_new=未定义/旧值 -> q, k_new, v_new 接收 split(self.q(x)), split(self.k(x)), split(self.v(x)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        if cache is None:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            k, v, s_past = k_new, v_new, 0
            # [变化示例] k, v, s_past=未定义/旧值 -> k, v, s_past=tuple (k_new, v_new, 0)；多个值按位置传递/解包，元素本身不被复制。
        else:
            # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
            s_past = cache[0].size(2)
            # [变化示例] s_past=未定义/旧值 -> s_past=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
            k = torch.cat((cache[0], k_new), dim=2)
            # [变化示例] k=未定义/旧值 -> k 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。
            v = torch.cat((cache[1], v_new), dim=2)
            # [变化示例] v=未定义/旧值 -> v 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.dh)
        # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        # query 的绝对位置从 s_past 开始，兼容单 token 和 chunk decode
        q_pos = s_past + torch.arange(s_new, device=x.device)
        # [变化示例] q_pos=未定义/旧值 -> q_pos=s_past + torch.arange(s_new, device=x.device)；数值示例：2 + 3 -> 5。
        k_pos = torch.arange(k.size(2), device=x.device)
        # [变化示例] k_pos=未定义/旧值 -> k_pos=等差序列 arange(k.size(2)；例如 arange(4) 为 [0,1,2,3]。
        future = k_pos[None, :] > q_pos[:, None]
        # [变化示例] future=未定义/旧值 -> future 新增长度为 1 的轴；例如 (B,D) -> (B,1,D)，元素值不变。
        ctx = torch.softmax(scores.masked_fill(future, float("-inf")), -1) @ v
        # [变化示例] ctx=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 ctx；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        out = self.o(ctx.transpose(1, 2).contiguous().view(b, s_new, -1))
        # [变化示例] out=未定义/旧值 -> out 接收 self.o(ctx.transpose(1, 2).contiguous().view(b, s_new, -1)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return out, (k, v)
        # [变化示例] 函数内部：out, (k, v)；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** Cache 形状是 `(B,H,S_cached,Dh)`。它减少的是历史 K/V 投影和历史 attention 输入准备；注意单 token 的 query 仍需与全部历史 keys 做点积，因此普通 attention 的每步计算仍随上下文长度增长。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：prefill 输入 4 个 token 后 cache 的 K/V 长度为 4；再输入 1 个 token，cache 变成长度 5，只返回新 token 的 `(B,1,D)` 输出。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 15. SwiGLU MLP

**Problem.** Implement `down(SiLU(gate(x)) * up(x))`, the gated feed-forward layer used by modern LLMs.

**中文题意。** 实现 SwiGLU：输入经过 gate 和 up 两条投影，用 SiLU 激活 gate 后逐元素相乘，再投影回模型维度。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{SwiGLU}(x)=\operatorname{SiLU}(xW_g)\odot(xW_u)W_d
$$

- **公式 / 不变量。** 门控分支决定哪些通道通过，up 分支提供内容，逐元素乘积形成数据依赖的特征选择。
- **算法拆解。** 并行计算 gate/up 投影，SiLU 激活 gate，逐元素相乘后降维；两分支 shape 必须相同。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class SwiGLUMLP(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.gate_proj = nn.Linear(d_model, d_ff)
        # [变化示例] self.gate_proj=未定义/旧值 -> self.gate_proj=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_ff。
        self.up_proj = nn.Linear(d_model, d_ff)
        # [变化示例] self.up_proj=未定义/旧值 -> self.up_proj=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_ff。
        self.down_proj = nn.Linear(d_ff, d_model)
        # [变化示例] self.down_proj=未定义/旧值 -> self.down_proj=线性映射模块；输入最后一维 d_ff -> 输出最后一维 d_model。

    def forward(self, x):
        # 两条分支都是 (...,Dff)，逐元素门控后回到 (...,Dmodel)
        gate = F.silu(self.gate_proj(x))
        # [变化示例] gate=未定义/旧值 -> gate=SiLU 激活；例如 [-1,0,1] -> 约 [-0.269,0,0.731]。
        content = self.up_proj(x)
        # [变化示例] content=未定义/旧值 -> content 接收 self.up_proj(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return self.down_proj(gate * content)
        # [变化示例] 函数内部：执行 self.down_proj(gate * content) 得到结果 -> 调用方收到该输出。
```

**中文解释。** `up_proj` 提供内容，`gate_proj` 决定哪些扩展特征通过。相比单一路径 GELU MLP，门控机制通常提供更强表达能力。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `F.silu`：SiLU/Swish：`x*sigmoid(x)`；SwiGLU 用它处理 gate 分支后再与 value 分支逐元素相乘。

#### 输入与输出示例

- **输入/调用**：输入 `(2,10,64)`，gate/up 投影到 hidden 维如 256；`silu(gate)*up` 仍为 `(2,10,256)`，down projection 输出 `(2,10,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 16. Cross-Entropy Loss

**Problem.** Implement mean class-index cross-entropy for logits `(B,C)` without built-in cross-entropy.

**中文题意。** 输入未归一化 logits 和每个样本的类别下标，使用稳定的 log-sum-exp 计算平均负对数似然。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}=-\frac1N\sum_{n=1}^{N}\log\frac{e^{z_{n,y_n}}}{\sum_c e^{z_{n,c}}}
$$

- **公式 / 不变量。** 交叉熵等价于正确类别的负 log-softmax；稳定实现应使用 log-sum-exp 而非先算概率再取 log。
- **算法拆解。** 每行 logits 减最大值，计算 logsumexp，再取目标类别得分；时间复杂度 O(NC)。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def cross_entropy_loss(logits, targets):
    # log_softmax(x) = x - logsumexp(x)
    log_probs = logits - torch.logsumexp(logits, dim=-1, keepdim=True)
    # [变化示例] log_probs=未定义/旧值 -> log_probs=logits - torch.logsumexp(logits, dim=-1, keepdim=True)；数值示例：3 - 2 -> 1。
    rows = torch.arange(targets.numel(), device=targets.device)
    # [变化示例] rows=未定义/旧值 -> rows=等差序列 arange(targets.numel()；例如 arange(4) 为 [0,1,2,3]。
    # 取出每个样本真实类别的 log probability，再取负均值
    return -log_probs[rows, targets].mean()
    # [变化示例] 函数内部：执行 -log_probs[rows, targets].mean() 得到结果 -> 调用方收到该输出。
```

**中文解释。** 不需要先计算 Softmax 再取 log，因为那样更容易发生下溢。`logsumexp` 将两步合并为稳定计算。`targets` 必须是整数类别索引。

#### 代码/API 逐项解释

- `torch.logsumexp`：稳定计算 `log(sum(exp(x)))`，内部等价于先减最大值；Cross-Entropy 中可避免显式 softmax。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：logits `[[2.,0.,-1.]]`、target `[0]` 时，输出是类别 0 的负对数概率，约 `0.1698`，是标量 loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 17. Dropout

**Problem.** During training, drop elements with probability `p` and preserve expectation; during evaluation, return the input unchanged.

**中文题意。** 训练时随机将元素置零，并将保留元素放大 `1/(1-p)`；推理时不做任何变化。

### Reviewed Solution

#### 数学、公式与算法思路

$$
y_i=\frac{m_i}{1-p}x_i,\qquad m_i\sim\operatorname{Bernoulli}(1-p)
$$

- **公式 / 不变量。** inverted dropout 在训练时除以保留概率，使输出期望仍等于输入；推理时无需缩放。
- **算法拆解。** 训练模式采样独立 mask 并缩放，评估模式原样返回；边界 p=0 和 p=1 要单独处理。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MyDropout(nn.Module):
    def __init__(self, p=0.5):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if not 0.0 <= p <= 1.0:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("p must be in [0,1]")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.p = p
        # [变化示例] self.p=未定义/旧值 -> self.p=p；这是一次重新绑定/状态更新，右侧值决定新状态。

    def forward(self, x):
        if not self.training or self.p == 0.0:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            return x
            # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
        if self.p == 1.0:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            return torch.zeros_like(x)
            # [变化示例] 函数内部：全 0 张量；shape 与参照张量相同 -> 调用方收到该输出。
        # keep 概率为 1-p；除以 1-p 后 E[output]=x
        keep = (torch.rand_like(x) >= self.p).to(x.dtype)
        # [变化示例] keep=未定义/旧值 -> keep 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        return x * keep / (1.0 - self.p)
        # [变化示例] 函数内部：x * keep / (1.0 - self.p)；数值示例：2 * 3 -> 6 -> 调用方收到该输出。
```

**中文解释。** 这是 inverted dropout。训练时已经完成期望值校正，因此 eval 阶段直接返回输入。额外处理 `p=1` 可避免除零。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `torch.rand_like`：在 `[0,1)` 上均匀采样，并继承参照张量的 shape、dtype、device，常用于 dropout mask 或接受/拒绝采样。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：输入 `[1.,1.,1.,1.]`、`p=0.5`；某次 mask 可能为 `[1,0,1,0]`，训练输出 `[2,0,2,0]`，eval 输出原向量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 18. Embedding Layer

**Problem.** Store a trainable embedding table and return rows selected by integer token IDs.

**中文题意。** 不使用 `nn.Embedding`，创建一个可训练查找表，并通过 token ID 索引对应行。

### Reviewed Solution

#### 数学、公式与算法思路

$$
Y_{b,s,:}=W_{I_{b,s},:},\qquad W\in\mathbb{R}^{V\times D}
$$

- **公式 / 不变量。** Embedding 本质是按整数 token id 查参数表，不是 one-hot 矩阵乘法的显式实现。
- **算法拆解。** 检查索引范围后做行选择，输出 shape 在输入索引后追加 D；反向只更新被访问的行。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MyEmbedding(nn.Module):
    def __init__(self, num_embeddings, embedding_dim):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        # 每一行对应一个 token 的 D 维向量
        self.weight = nn.Parameter(torch.randn(num_embeddings, embedding_dim))
        # [变化示例] self.weight=未定义/旧值 -> self.weight=注册后的可训练参数；原 tensor shape/dtype/device 保持，默认 requires_grad -> True。

    def forward(self, indices):
        # (B,S) 索引 -> (B,S,D) embedding
        return self.weight[indices]
        # [变化示例] 函数内部：索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,) -> 调用方收到该输出。
```

**中文解释。** 索引操作仍支持 autograd。梯度只更新本批次出现过的行；重复 token 的梯度会累加到同一行。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。

#### 输入与输出示例

- **输入/调用**：权重表 shape `(vocab=1000,D=64)`，token ids shape `(2,5)`；索引后输出 `(2,5,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 19. GELU

**Problem.** Implement exact GELU using the Gaussian error function, without built-in GELU.

**中文题意。** 按精确公式 `x * Phi(x)` 实现 GELU，使用 `torch.erf`，不能调用内置 GELU。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{GELU}(x)\approx\frac{x}{2}\left(1+\tanh\!\left[\sqrt{\frac{2}{\pi}}(x+0.044715x^3)\right]\right)
$$

- **公式 / 不变量。** GELU 以平滑概率门控输入，负值不会像 ReLU 那样全部截断。
- **算法拆解。** 按 tanh 近似逐元素计算；注意常数、三次项和括号，复杂度 O(N)。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def my_gelu(x):
    # Phi 是标准高斯分布的累积分布函数
    # Phi(x)=0.5*(1+erf(x/sqrt(2)))
    return 0.5 * x * (1.0 + torch.erf(x / math.sqrt(2.0)))
    # [变化示例] 函数内部：0.5 * x * (1.0 + torch.erf(x / math.sqrt(2.0)))；数值示例：2 * 3 -> 6 -> 调用方收到该输出。
```

**中文解释。** GELU 根据输入在标准高斯分布下的累计概率进行平滑门控，不像 ReLU 那样硬截断负数。部分模型使用 tanh 近似以加速计算。

#### 代码/API 逐项解释

- `torch.erf`：误差函数；精确 GELU 可写成 `0.5*x*(1+erf(x/sqrt(2)))`。

- **GELU 公式拆解**：`math.sqrt(2.0)` 是 Python 标量常数；`x / sqrt(2)` 仍是张量，`erf` 后与 x 逐元素相乘，因此输入输出 shape 完全一致。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。

#### 输入与输出示例

- **输入/调用**：输入 `[-1.,0.,1.]`，精确 GELU 输出约 `[-0.1587,0,0.8413]`，负值被平滑抑制而非硬置零。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 20. Kaiming Initialization

**Problem.** Initialize weights from `N(0, 2/fan_in)` in place.

**中文题意。** 根据输入连接数计算标准差 `sqrt(2/fan_in)`，用正态分布原地初始化权重。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{Var}(W)=\frac{2}{fan_{in}}\quad\text{for ReLU networks}
$$

- **公式 / 不变量。** Kaiming 初始化根据 ReLU 截断约一半方差的现象选择权重尺度，防止层间激活爆炸或衰减。
- **算法拆解。** 计算 fan-in，按正态标准差 sqrt(2/fan-in) 或对应均匀区间采样；卷积 fan-in 还包含核面积。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def kaiming_init(weight):
    if weight.dim() < 2:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("weight must have at least two dimensions")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    # 输入连接数：Linear 为 Din；卷积为 Cin*kH*kW
    fan_in = weight[0].numel()
    # [变化示例] fan_in=未定义/旧值 -> fan_in=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
    std = math.sqrt(2.0 / fan_in)
    # [变化示例] std=未定义/旧值 -> std 接收 math.sqrt(2.0 / fan_in) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    with torch.no_grad():
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        weight.normal_(0.0, std)
        # [变化示例] 执行状态：调用 weight.normal_(0.0, std) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    return weight
    # [变化示例] 函数内部：weight；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** Kaiming 初始化针对 ReLU 类激活保持前向信号方差。仓库答案只使用 `shape[1]`，对 Linear 正确，但对卷积会漏掉 kernel 面积；这里改为更通用的 fan-in。

#### 代码/API 逐项解释

- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。

- `weight[0].numel()`：取第一个输出单元连接的全部权重数作为 fan-in；Linear 得到 Din，卷积核得到 `Cin*kH*kW`。
- **初始化输出**：函数原地改写传入 weight 并返回同一个张量对象；数值分布改变，但 shape/dtype/device 不变。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.normal_(...)`：`.normal_(mean,std)` 原地填充正态随机数；参数初始化应放在 `no_grad` 中。

#### 输入与输出示例

- **输入/调用**：权重 shape `(out=64,in=128)`，fan-in=128；Kaiming normal 标准差约 `sqrt(2/128)=0.125`，输出仍是同一 Parameter。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 21. Gradient Norm Clipping

**Problem.** Clip the combined L2 norm of all existing gradients to `max_norm` and return the original norm.

**中文题意。** 把所有参数梯度视作一个大向量；若总 L2 norm 超过阈值，就用同一个比例缩放全部梯度。

### Reviewed Solution

#### 数学、公式与算法思路

$$
g'=g\cdot\min\!\left(1,\frac{c}{\lVert g\rVert_2+\epsilon}\right)
$$

- **公式 / 不变量。** 全局范数裁剪保持梯度方向不变，只在总范数超过阈值时统一缩小。
- **算法拆解。** 先累加所有参数梯度平方得到全局 L2 范数，再用同一系数缩放；不能逐参数各自裁剪。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def clip_grad_norm(parameters, max_norm):
    if max_norm < 0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("max_norm must be non-negative")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    grads = [p.grad for p in parameters if p.grad is not None]
    # [变化示例] grads=未定义/旧值 -> grads=[p.grad for p in parameters if p.grad is not None]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    if not grads:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        return 0.0
        # [变化示例] 函数内部：0.0；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
    # 先算每个参数的 norm，再合成为全局 norm
    norms = torch.stack([torch.linalg.vector_norm(g.detach(), 2) for g in grads])
    # [变化示例] norms=未定义/旧值 -> norms 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0）。
    total = torch.linalg.vector_norm(norms, 2)
    # [变化示例] total=未定义/旧值 -> total=全局向量范数；例如 [3,4] 的 L2 norm -> 5。
    coef = (max_norm / (total + 1e-6)).clamp(max=1.0)
    # [变化示例] coef=未定义/旧值 -> coef 接收 (max_norm / (total + 1e-6)).clamp(max=1.0) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    with torch.no_grad():
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for grad in grads:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            grad.mul_(coef.to(grad.device))
            # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 grad.mul_(coef.to(grad.device)) 后直接覆盖同一 storage。
    return total.item()
    # [变化示例] 函数内部：单元素 tensor 转成 Python 标量；例如 tensor(2.5) -> 2.5 -> 调用方收到该输出。
```

**中文解释。** 所有梯度乘同一系数，因此方向保持不变，只缩短长度。若没有梯度，应直接返回 0。`1e-6` 防止总 norm 为 0 时除零。

#### 代码/API 逐项解释

- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `torch.linalg.vector_norm`：计算向量 p-norm；这里先对每个梯度张量的全部元素求 L2 norm，得到若干标量，再把这些标量 stack 后再求一次 L2 norm，数学上等价于把所有参数梯度展平成一个大向量求全局范数。输出是 0 维标量张量，并保留输入 dtype/device。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。

- `.mul_(...)`：`.mul_` 是原地乘法；Adam 衰减 moving average 时避免分配新张量。

#### 输入与输出示例

- **输入/调用**：两个参数梯度范数分别为 3 和 4，总范数为 5；若 `max_norm=1`，所有梯度统一乘约 0.2，方向不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 22. 2D Convolution

**Problem.** Implement Conv2D with scalar stride, padding, and optional bias without using `conv2d`.

**中文题意。** 将输入切成滑动窗口，并让每个窗口与卷积核做加权求和，支持步长、零填充和偏置。

### Reviewed Solution

#### 数学、公式与算法思路

$$
Y_{n,o,i,j}=b_o+\sum_c\sum_u\sum_v W_{o,c,u,v}X_{n,c,i+u,j+v}
$$

- **公式 / 不变量。** 二维卷积在空间位置共享同一组核参数；输出尺寸由 kernel、stride、padding、dilation 决定。
- **算法拆解。** 先算输出高宽，再提取每个局部窗口与卷积核做乘加；朴素复杂度 O(BH_oW_oC_iC_ok_hk_w)。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def my_conv2d(x, weight, bias=None, stride=1, padding=0):
    if padding:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        x = F.pad(x, (padding, padding, padding, padding))
        # [变化示例] x=未定义/旧值 -> x=padding 后张量；二维每侧补 p 时 (H,W) -> (H+2p,W+2p)。
    _, _, h, w = x.shape
    # [变化示例] _, _, h, w=未定义/旧值 -> _, _, h, w=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
    _, _, kh, kw = weight.shape
    # [变化示例] _, _, kh, kw=未定义/旧值 -> _, _, kh, kw=weight.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
    # patches: (B,Cin,Hout,Wout,kH,kW)
    patches = x.unfold(2, kh, stride).unfold(3, kw, stride)
    # [变化示例] patches=未定义/旧值 -> patches=滑动窗口 view；输入空间维 -> 窗口位置轴与 kernel 轴。
    # 对 Cin、kH、kW 三个维度求和 -> (B,Cout,Hout,Wout)
    out = torch.einsum("bihwjk,oijk->bohw", patches, weight)
    # [变化示例] out=未定义/旧值 -> out=按 einsum 下标收缩；相同字母维相乘/求和，输出只保留箭头右侧字母。
    if bias is not None:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        out = out + bias.view(1, -1, 1, 1)
        # [变化示例] out=未定义/旧值 -> out=out + bias.view(1, -1, 1, 1)；数值示例：2 + 3 -> 5。
    return out
    # [变化示例] 函数内部：out；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** `unfold` 不直接计算卷积，而是创建窗口视图。`einsum` 明确表达卷积核与每个 patch 的 contraction。该实现清晰但不是高性能卷积内核。

#### 代码/API 逐项解释

- `F.pad`：按从最后一维向前的顺序填充张量；2D 图像的参数顺序是 `(left,right,top,bottom)`。
- `torch.einsum`：用爱因斯坦下标显式描述张量收缩；表达灵活但必须逐个核对每个字母代表的轴。
- `.unfold(...)`：在指定轴创建滑动窗口 view。对 `(B,C,H,W)` 先 `unfold(2,kH,stride)` 再 `unfold(3,kW,stride)`，得到 `(B,C,Hout,Wout,kH,kW)`；它通常共享原存储，窗口可能重叠，不能把输出误认为已复制的 patch tensor。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。

#### 输入与输出示例

- **输入/调用**：输入 `(B=2,Cin=3,H=32,W=32)`、卷积核 `(Cout=16,3,3,3)`、padding=1/stride=1，输出 `(2,16,32,32)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 23. Multi-Head Cross-Attention

**Problem.** Generate Q from decoder states and K/V from encoder states, with no causal mask over encoder positions.

**中文题意。** 在 encoder-decoder 模型中，decoder hidden states 产生 Q，encoder outputs 产生 K 和 V；每个 decoder query 可看见全部 encoder token。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{CrossAttn}(X_q,X_{kv})=\operatorname{softmax}\!\left(\frac{Q(X_q)K(X_{kv})^\top}{\sqrt d}\right)V(X_{kv})
$$

- **公式 / 不变量。** 交叉注意力的 query 和 key/value 来自不同序列，因此 query 长度可以不同于上下文长度。
- **算法拆解。** 分别投影 query 与上下文，按 head 拆分，验证 K/V 长度相同，再做注意力和输出投影。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MultiHeadCrossAttention(MultiHeadAttention):
    def forward(self, x_q, x_kv):
        # Q: (B,Sq,D)，K/V: (B,Skv,D)，输出长度跟随 Sq
        return super().forward(x_q, x_kv, x_kv)
        # [变化示例] 函数内部：执行 super().forward(x_q, x_kv, x_kv) 得到结果 -> 调用方收到该输出。
```

**中文解释。** Cross-attention 与 self-attention 的核心计算相同，区别只在 Q 与 K/V 的来源。这里复用第 06 题经过审查的实现，可避免重复代码。

#### 代码/API 逐项解释



- `super().forward(x_q, x_kv, x_kv)`：复用父类 MHA 的投影、拆头、softmax 和合头逻辑，只把 Q 来源改为 `x_q`，K/V 都来自 `x_kv`。
- **长度语义**：输出序列长度跟随 query 的 `Sq`，attention 概率最后一维长度跟随 context 的 `Skv`。
- **继承边界**：这种写法要求父类 forward 接受三个输入且 mask 语义兼容；面试时应明确父类 contract，而不是只说“调用 super”。

#### 输入与输出示例

- **输入/调用**：query `(2,4,64)` 来自 decoder，context `(2,10,64)` 来自 encoder；attention 权重 `(2,H,4,10)`，输出 `(2,4,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 24. Rotary Position Embedding (RoPE)

**Problem.** Rotate consecutive feature pairs with position-dependent angles so Q/K dot products encode relative positions.

**中文题意。** 将最后一维按相邻两个元素分组，对每组执行二维旋转；不同位置使用不同角度，从而把位置信息写入 Q/K。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\begin{bmatrix}x'_{2i}\\x'_{2i+1}\end{bmatrix}=\begin{bmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{bmatrix}\begin{bmatrix}x_{2i}\\x_{2i+1}\end{bmatrix}
$$

- **公式 / 不变量。** RoPE 对相邻特征维成对旋转；Q 与 K 的内积因此自然编码相对位置差。
- **算法拆解。** 生成各位置和频率的角度，拆分偶数/奇数维，应用二维旋转后交错还原；head dimension 通常必须为偶数。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def apply_rope(q, k):
    if q.shape != k.shape or q.size(-1) % 2:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("q/k must match and D must be even")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    _, s, d = q.shape
    # [变化示例] _, s, d=未定义/旧值 -> _, s, d=q.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
    pos = torch.arange(s, device=q.device, dtype=torch.float32)[:, None]
    # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(s, device=q.device, dtype=torch.float32)；例如 arange(4) 为 [0,1,2,3]。
    dims = torch.arange(0, d, 2, device=q.device, dtype=torch.float32)
    # [变化示例] dims=未定义/旧值 -> dims=等差序列 arange(0, d, 2, device=q.device, dtype=torch...)；例如 arange(4) 为 [0,1,2,3]。
    # 不同维度使用不同旋转频率，angles 形状为 (S,D/2)
    angles = pos * (10000.0 ** (-dims / d))
    # [变化示例] angles=未定义/旧值 -> angles=pos * (10000.0 ** (-dims / d))；数值示例：2 * 3 -> 6。
    cos, sin = angles.cos().to(q.dtype), angles.sin().to(q.dtype)
    # [变化示例] cos, sin=未定义/旧值 -> cos, sin 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

    def rotate(x):
        even, odd = x[..., 0::2], x[..., 1::2]
        # [变化示例] even, odd=未定义/旧值 -> even, odd=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        # [a,b] -> [a*cos-b*sin, a*sin+b*cos]
        return torch.stack((even*cos - odd*sin, even*sin + odd*cos), -1).flatten(-2)
        # [变化示例] 函数内部：result 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0） -> 调用方收到该输出。

    return rotate(q), rotate(k)
    # [变化示例] 函数内部：执行 rotate(q), rotate(k) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 对 Q/K 应用相同频率体系后，它们的点积依赖位置差而不是绝对位置。生产实现还会支持 `(B,H,S,Dh)` 和 KV-cache 的 position offset。

#### 代码/API 逐项解释

- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。

#### 输入与输出示例

- **输入/调用**：`q,k.shape=(B,H,S,Dh)` 且 `Dh=8`；每两个通道作为二维向量按位置旋转，输出 shape 不变，位置 0 旋转角为 0。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 25. Tiled Flash-Attention Idea

**Problem.** Process K/V in blocks and use online softmax to match full attention without materializing its entire score matrix.

**中文题意。** 分块计算 attention，并为每一行维护当前最大值、指数和、输出累加器；最大值变化时必须重新缩放旧结果。

### Reviewed Solution

#### 数学、公式与算法思路

$$
m_i^{new}=\max(m_i,m_{ij}),\quad l_i^{new}=e^{m_i-m_i^{new}}l_i+\sum_j e^{s_{ij}-m_i^{new}}
$$

- **公式 / 不变量。** Online Softmax 用运行最大值和归一化和合并 tile，避免保存完整注意力矩阵且保持数值稳定。
- **算法拆解。** 按 Q/K/V tile 扫描，更新每行 m、l 和缩放后的输出累加器；最终除以 l，精确等价于普通 Softmax。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def flash_attention(Q, K, V, block_size=32):
    b, sq, d = Q.shape
    # [变化示例] b, sq, d=未定义/旧值 -> b, sq, d=Q.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
    dv = V.size(-1)
    # [变化示例] dv=未定义/旧值 -> dv=指定轴长度；例如 shape=(2,3,4)，size(-1) -> 对应维长度。
    output = Q.new_empty(b, sq, dv)
    # [变化示例] output=未定义/旧值 -> output=按给定 shape 创建且继承模板 dtype/device；例如模板在 CUDA float16 -> 新张量也在 CUDA float16。
    for i in range(0, sq, block_size):
        # [变化示例] 循环示例：range(0, sq, block_size) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        qi = Q[:, i:i+block_size]
        # [变化示例] qi=未定义/旧值 -> qi=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        rows = qi.size(1)
        # [变化示例] rows=未定义/旧值 -> rows=指定轴长度；例如 shape=(2,3,4)，size(1) -> 3。
        row_max = Q.new_full((b, rows, 1), float("-inf"))
        # [变化示例] row_max=未定义/旧值 -> row_max=按给定 shape 创建且继承模板 dtype/device；例如模板在 CUDA float16 -> 新张量也在 CUDA float16。
        row_sum = Q.new_zeros(b, rows, 1)
        # [变化示例] row_sum=未定义/旧值 -> row_sum=按给定 shape 创建且继承模板 dtype/device；例如模板在 CUDA float16 -> 新张量也在 CUDA float16。
        acc = V.new_zeros(b, rows, dv)
        # [变化示例] acc=未定义/旧值 -> acc=按给定 shape 创建且继承模板 dtype/device；例如模板在 CUDA float16 -> 新张量也在 CUDA float16。
        for j in range(0, K.size(1), block_size):
            # [变化示例] 循环示例：range(0, K.size(1) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            kj, vj = K[:, j:j+block_size], V[:, j:j+block_size]
            # [变化示例] kj, vj=未定义/旧值 -> kj, vj=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
            scores = torch.bmm(qi, kj.transpose(1, 2)) / math.sqrt(d)
            # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
            new_max = torch.maximum(row_max, scores.amax(-1, keepdim=True))
            # [变化示例] new_max=未定义/旧值 -> new_max=逐元素较小/较大值；例如 minimum([2,5],[3,4]) -> [2,4]。
            # 新最大值出现时，旧 exp 和旧 numerator 都要同比缩放
            correction = torch.exp(row_max - new_max)
            # [变化示例] correction=未定义/旧值 -> correction=逐元素指数；例如 [0,1] -> [1,2.718]。
            exp_scores = torch.exp(scores - new_max)
            # [变化示例] exp_scores=未定义/旧值 -> exp_scores=逐元素指数；例如 [0,1] -> [1,2.718]。
            acc = acc * correction + torch.bmm(exp_scores, vj)
            # [变化示例] acc=未定义/旧值 -> acc=acc * correction + torch.bmm(exp_scores, vj)；数值示例：2 + 3 -> 5。
            row_sum = row_sum * correction + exp_scores.sum(-1, keepdim=True)
            # [变化示例] row_sum=未定义/旧值 -> row_sum=row_sum * correction + exp_scores.sum(-1, keepdim=True)；数值示例：2 + 3 -> 5。
            row_max = new_max
            # [变化示例] row_max=未定义/旧值 -> row_max=new_max；这是一次重新绑定/状态更新，右侧值决定新状态。
        output[:, i:i+block_size] = acc / row_sum
        # [变化示例] output[:, i:i+block_size]=未定义/旧值 -> output[:, i:i+block_size]=acc / row_sum；数值示例：6 / 3 -> 2。
    return output
    # [变化示例] 函数内部：output；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** Online Softmax 允许逐块处理时仍得到与完整 Softmax 相同的结果。此 Python 版本展示算法原理，但不是 fused GPU kernel，实际速度可能比 PyTorch 内置 attention 慢。

#### 代码/API 逐项解释

- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `torch.maximum`：逐元素取两张量较大值，并支持 broadcasting；online softmax 用它更新运行最大值。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.new_empty(...)`：`.new_empty(shape)` 只分配不初始化；只有随后完整写入时才安全。
- `.new_full(...)`：`.new_full(shape,value)` 以当前张量为模板创建常数张量，避免设备和精度不匹配。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：`Q,K,V.shape=(1,128,64)`、block=32；算法逐块维护行最大值和归一化和，输出 `(1,128,64)`，不保存完整 `(128,128)` 矩阵。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 26. LoRA Linear

**Problem.** Freeze a base linear layer and learn the low-rank update `(alpha/r)BA`.

**中文题意。** 基础 Linear 参数冻结，只训练两个低秩矩阵 A、B，并将低秩更新加到基础输出上。

### Reviewed Solution

#### 数学、公式与算法思路

$$
W'=W+\frac{\alpha}{r}BA,\qquad A\in\mathbb{R}^{r\times d_{in}},\ B\in\mathbb{R}^{d_{out}\times r}
$$

- **公式 / 不变量。** LoRA 冻结原权重，只训练低秩增量；参数量从 d_out×d_in 降为 r(d_in+d_out)。
- **算法拆解。** 基座线性输出加上 xA^T再乘B^T 的支路并按 alpha/r 缩放；部署时可把增量 merge 回 W。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class LoRALinear(nn.Module):
    def __init__(self, in_features, out_features, rank, alpha=1.0):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if rank <= 0:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("rank must be positive")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.linear = nn.Linear(in_features, out_features)
        # [变化示例] self.linear=未定义/旧值 -> self.linear=线性映射模块；输入最后一维 in_features -> 输出最后一维 out_features。
        self.linear.requires_grad_(False)  # 冻结 W0 和 bias
        self.lora_A = nn.Parameter(torch.randn(rank, in_features) * 0.01)
        # [变化示例] self.lora_A=未定义/旧值 -> self.lora_A=注册后的可训练参数；原 tensor shape/dtype/device 保持，默认 requires_grad -> True。
        self.lora_B = nn.Parameter(torch.zeros(out_features, rank))
        # [变化示例] self.lora_B=未定义/旧值 -> self.lora_B=注册后的可训练参数；原 tensor shape/dtype/device 保持，默认 requires_grad -> True。
        self.scaling = alpha / rank
        # [变化示例] self.scaling=未定义/旧值 -> self.scaling=alpha / rank；数值示例：6 / 3 -> 2。

    def forward(self, x):
        # (...,Din) @ (Din,r) @ (r,Dout) -> (...,Dout)
        update = (x @ self.lora_A.T) @ self.lora_B.T
        # [变化示例] update=未定义/旧值 -> update=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        return self.linear(x) + self.scaling * update
        # [变化示例] 函数内部：self.linear(x) + self.scaling * update；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** B 初始化为 0，使训练开始时 LoRA 输出严格为 0，不改变预训练模型行为。低秩参数量从 `Din*Dout` 降为 `r*(Din+Dout)`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.requires_grad_(...)`：`.requires_grad_(True)` 原地设置是否追踪梯度；只对浮点/复数张量有效。

#### 输入与输出示例

- **输入/调用**：基础 Linear 输入 `(2,5,64)`、LoRA rank=4；A 投影到 `(2,5,4)`，B 投影回 `(2,5,Dout)`，与 base 输出相加。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 27. ViT Patch Embedding

**Problem.** Split images into non-overlapping patches and project each flattened patch to an embedding.

**中文题意。** 把 `(B,C,H,W)` 图像切成不重叠的 `P x P` patch，展平每个 patch，再映射到 Transformer embedding。

### Reviewed Solution

#### 数学、公式与算法思路

$$
N=\frac{H}{P}\frac{W}{P},\qquad Z\in\mathbb{R}^{B\times N\times D}
$$

- **公式 / 不变量。** Patch Embedding 把每个 P×P 图像块展平并线性投影成 token；卷积核和步长都取 P 可一次完成。
- **算法拆解。** 检查 H/W 可被 P 整除，卷积得到 B×D×H/P×W/P，再 flatten 空间并转成 B×N×D。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class PatchEmbedding(nn.Module):
    def __init__(self, img_size, patch_size, in_channels, embed_dim):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if img_size % patch_size:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("image size must divide patch size")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.p = patch_size
        # [变化示例] self.p=未定义/旧值 -> self.p=patch_size；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.num_patches = (img_size // patch_size) ** 2
        # [变化示例] self.num_patches=未定义/旧值 -> self.num_patches=(img_size // patch_size) ** 2；数值示例：2 ** 3 -> 8。
        self.proj = nn.Linear(in_channels * patch_size**2, embed_dim)
        # [变化示例] self.proj=未定义/旧值 -> self.proj=线性映射模块；输入最后一维 in_channels * patch_size**2 -> 输出最后一维 embed_dim。

    def forward(self, x):
        b, c, h, w = x.shape
        # [变化示例] b, c, h, w=未定义/旧值 -> b, c, h, w=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        if h % self.p or w % self.p:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("H and W must be divisible by patch size")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        nh, nw = h // self.p, w // self.p
        # [变化示例] nh, nw=未定义/旧值 -> nh, nw=h // self.p, w // self.p；数值示例：7 // 3 -> 2。
        # 先拆出 patch 网格，再把每个 patch 展平成一个 token
        # (B,C,Nh,P,Nw,P) -> (B,Nh,Nw,C,P,P) -> (B,N,C*P*P)
        patches = x.reshape(b, c, nh, self.p, nw, self.p)
        # [变化示例] patches=未定义/旧值 -> patches 重排为 b, c, nh, self.p, nw, self.p；元素数量与顺序保持不变（若布局允许则共享 storage）。
        patches = patches.permute(0, 2, 4, 1, 3, 5)
        # [变化示例] patches=未定义/旧值 -> patches 的轴按 0, 2, 4, 1, 3, 5 重排；例如 (B,S,D) 交换后可变为 (B,D,S)，数值不复制。
        patches = patches.reshape(b, nh*nw, c*self.p*self.p)
        # [变化示例] patches=未定义/旧值 -> patches 重排为 b, nh*nw, c*self.p*self.p；元素数量与顺序保持不变（若布局允许则共享 storage）。
        return self.proj(patches)
        # [变化示例] 函数内部：执行 self.proj(patches) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 最关键的是 `permute`：把 patch 网格维度移到前面、channel 和 patch 内部维度移到后面。使用 `Conv2d(kernel=P,stride=P)` 可以等价并更高效地实现。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.permute(...)`：`.permute(...)` 任意重排轴，参数必须覆盖每个维度一次；只改变 stride 视图。

#### 输入与输出示例

- **输入/调用**：输入图像 `(2,3,224,224)`、patch=16，得到 `14*14=196` 个 patch；展平并投影后输出 `(2,196,D)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 28. Mixture of Experts

**Problem.** Route each token to its top-k expert MLPs and combine outputs using normalized router weights.

**中文题意。** Router 为每个 token 选择 top-k experts，将它们的输出按门控概率加权求和。

### Reviewed Solution

#### 数学、公式与算法思路

$$
y=\sum_{e\in\operatorname{TopK}(g(x))}p_e(x)E_e(x)
$$

- **公式 / 不变量。** MoE 路由器为每个 token 选择少量专家，计算量近似稠密模型但参数容量更大。
- **算法拆解。** 计算 router logits 和概率，取 top-k 专家，分发 token、加权汇总；还需容量限制和负载均衡避免专家塌缩。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MixtureOfExperts(nn.Module):
    def __init__(self, d_model, d_ff, num_experts, top_k=2):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if not 1 <= top_k <= num_experts:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("invalid top_k")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.top_k = top_k
        # [变化示例] self.top_k=未定义/旧值 -> self.top_k=top_k；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.router = nn.Linear(d_model, num_experts)
        # [变化示例] self.router=未定义/旧值 -> self.router=线性映射模块；输入最后一维 d_model -> 输出最后一维 num_experts。
        self.experts = nn.ModuleList([
            nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(), nn.Linear(d_ff, d_model))
            for _ in range(num_experts)
        ])
        # [变化示例] self.experts=未定义/旧值 -> self.experts=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。

    def forward(self, x):
        original = x.shape
        # [变化示例] original=未定义/旧值 -> original=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        flat = x.reshape(-1, x.size(-1))  # 每行是一个 token
        # [变化示例] flat=未定义/旧值 -> flat 重排为 -1, x.size(-1；元素数量与顺序保持不变（若布局允许则共享 storage）。
        top_logits, top_ids = self.router(flat).topk(self.top_k, dim=-1)
        # [变化示例] top_logits, top_ids=未定义/旧值 -> top_logits, top_ids 接收 self.router(flat).topk(self.top_k, dim=-1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        gates = torch.softmax(top_logits, dim=-1)
        # [变化示例] gates=未定义/旧值 -> gates=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
        output = torch.zeros_like(flat)
        # [变化示例] output=未定义/旧值 -> output=全 0 张量；shape 与参照张量相同。
        for slot in range(self.top_k):
            # [变化示例] 循环示例：range(self.top_k) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            for expert_id, expert in enumerate(self.experts):
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                selected = top_ids[:, slot] == expert_id
                # [变化示例] selected=未定义/旧值 -> selected=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
                if selected.any():
                    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                    output[selected] += gates[selected, slot, None] * expert(flat[selected])
                    # [变化示例] output[selected]=旧值 -> output[selected]=旧值 + (gates[selected, slot, None] * expert(flat[selected]))；数值示例：2 + 3 -> 5，并写回 output[selected]。
        return output.reshape(original)
        # [变化示例] 函数内部：result 重排为 original；元素数量与顺序保持不变（若布局允许则共享 storage） -> 调用方收到该输出。
```

**中文解释。** 这是功能正确的教学实现。生产 MoE 还需要 capacity、load-balancing loss、高效 token dispatch、跨设备 expert 并行和 dropped-token 策略。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ModuleList`：注册一组子模块但不定义连接方式；forward 中仍需显式循环或路由。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。
- `.any(...)`：`.any()` 判断是否至少有一个 True；空 cluster 检查可用它决定重算还是保留旧中心。

#### 输入与输出示例

- **输入/调用**：输入 6 个 token、3 个 experts、top-1 routing；router 输出 `(6,3)` 概率，每个 token 只送到选中 expert，聚合输出与输入同 shape。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 29. Adam Optimizer

**Problem.** Implement Adam with first/second moments and bias correction.

**中文题意。** 为每个参数维护梯度一阶矩和平方梯度二阶矩，进行偏差修正后更新参数。

### Reviewed Solution

#### 数学、公式与算法思路

$$
m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,\quad v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2,\quad \theta_t=\theta_{t-1}-\eta\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}
$$

- **公式 / 不变量。** Adam 用一阶动量平滑方向、二阶动量自适应缩放，并用偏差修正补偿初期零初始化。
- **算法拆解。** 逐参数更新 m/v，除以 1-beta^t 得到无偏估计，再更新参数；状态内存约为参数量的两倍。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MyAdam:
    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8):
        self.params = list(params)
        # [变化示例] self.params=未定义/旧值 -> self.params 接收 list(params) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.lr, self.beta1, self.beta2, self.eps = lr, betas[0], betas[1], eps
        # [变化示例] self.lr, self.beta1, self.beta2, self.eps=未定义/旧值 -> self.lr, self.beta1, self.beta2, self.eps=tuple (lr, betas[0], betas[1], eps)；多个值按位置传递/解包，元素本身不被复制。
        self.steps = [0] * len(self.params)
        # [变化示例] self.steps=未定义/旧值 -> self.steps=[0] * len(self.params)；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        self.m = [torch.zeros_like(p) for p in self.params]
        # [变化示例] self.m=未定义/旧值 -> self.m=[torch.zeros_like(p) for p in self.params]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        self.v = [torch.zeros_like(p) for p in self.params]
        # [变化示例] self.v=未定义/旧值 -> self.v=[torch.zeros_like(p) for p in self.params]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

    def step(self):
        with torch.no_grad():
            # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
            for i, p in enumerate(self.params):
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                if p.grad is None:
                    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                    continue
                self.steps[i] += 1
                # [变化示例] self.steps[i]=旧值 -> self.steps[i]=旧值 + (1)；数值示例：2 + 3 -> 5，并写回 self.steps[i]。
                t, g = self.steps[i], p.grad
                # [变化示例] t, g=未定义/旧值 -> t, g=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
                # m=beta1*m+(1-beta1)*g；v 同理累计 g^2
                self.m[i].lerp_(g, 1.0 - self.beta1)
                self.v[i].mul_(self.beta2).addcmul_(g, g, value=1.0-self.beta2)
                # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 self.v[i].mul_(self.beta2).addcmul_(g, g, value=1.0-sel... 后直接覆盖同一 storage。
                m_hat = self.m[i] / (1.0 - self.beta1**t)
                # [变化示例] m_hat=未定义/旧值 -> m_hat=self.m[i] / (1.0 - self.beta1**t)；数值示例：6 / 3 -> 2。
                v_hat = self.v[i] / (1.0 - self.beta2**t)
                # [变化示例] v_hat=未定义/旧值 -> v_hat=self.v[i] / (1.0 - self.beta2**t)；数值示例：6 / 3 -> 2。
                p.addcdiv_(m_hat, v_hat.sqrt().add_(self.eps), value=-self.lr)
                # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 p.addcdiv_(m_hat, v_hat.sqrt().add_(self.eps), value=-s... 后直接覆盖同一 storage。

    def zero_grad(self):
        # 设为 None 通常比填充 0 更省内存
        for p in self.params:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            p.grad = None
            # [变化示例] p.grad=未定义/旧值 -> p.grad=None；这是一次重新绑定/状态更新，右侧值决定新状态。
```

**中文解释。** 因为 m/v 从 0 开始，早期会偏小，所以必须除以 `1-beta^t`。这里为每个参数维护 step，比所有参数共享 step 更适合存在缺失梯度的情况。

#### 代码/API 逐项解释

- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.lerp_(...)`：`.lerp_(end,weight)` 原地线性插值；可把 moving average 更新写成稳定的一次操作。
- `.mul_(...)`：`.mul_` 是原地乘法；Adam 衰减 moving average 时避免分配新张量。
- `.addcmul_(...)`：`.addcmul_(a,b,value=...)` 原地执行 `self += value*a*b`；Adam 用它累计梯度平方。
- `.addcdiv_(...)`：`.addcdiv_(a,b,value=...)` 原地执行 `self += value*a/b`；Adam 用它完成归一化参数更新。
- `.sqrt(...)`：`.sqrt()` 逐元素开平方；方差、扩散系数等理论上非负，但浮点误差下仍应考虑 clamp/epsilon。
- `.add_(...)`：`.add_` 是原地加法；优化器用它更新参数或状态，结尾下划线表示会修改对象。

#### 输入与输出示例

- **输入/调用**：标量参数 1.0、梯度 0.1；第一步先更新一阶/二阶矩，再做 bias correction，输出是被原地更新的参数而不是新张量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 30. Cosine LR with Warmup

**Problem.** Linearly warm up to `max_lr`, then cosine-decay to `min_lr`.

**中文题意。** 前若干步线性增加学习率，之后沿半个余弦曲线平滑下降到最小学习率。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\eta_t=\begin{cases}\eta_{max}\,t/T_w&t<T_w\\\eta_{min}+\frac{\eta_{max}-\eta_{min}}2\left[1+\cos\left(\pi\frac{t-T_w}{T-T_w}\right)\right]&t\ge T_w\end{cases}
$$

- **公式 / 不变量。** warmup 先线性提高学习率以稳定早期训练，之后余弦衰减平滑降低到最小值。
- **算法拆解。** 先裁剪 step 到合法区间，按是否处于 warmup 分段计算；重点核对端点和总步数定义。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def cosine_lr_schedule(step, total_steps, warmup_steps, max_lr, min_lr=0.0):
    if not 0 <= warmup_steps < total_steps:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("invalid schedule lengths")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    if step < warmup_steps:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        # 0 -> max_lr 的线性预热
        return max_lr * step / max(warmup_steps, 1)
        # [变化示例] 函数内部：max_lr * step / max(warmup_steps, 1)；数值示例：2 * 3 -> 6 -> 调用方收到该输出。
    if step >= total_steps:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        return min_lr
        # [变化示例] 函数内部：min_lr；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    # [变化示例] progress=未定义/旧值 -> progress=(step - warmup_steps) / (total_steps - warmup_steps)；数值示例：6 / 3 -> 2。
    cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
    # [变化示例] cosine=未定义/旧值 -> cosine=0.5 * (1.0 + math.cos(math.pi * progress))；数值示例：2 * 3 -> 6。
    return min_lr + (max_lr - min_lr) * cosine
    # [变化示例] 函数内部：min_lr + (max_lr - min_lr) * cosine；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** Warmup 防止随机初始化阶段的大更新破坏训练；Cosine decay 在后期逐渐减小更新幅度。`progress` 从 0 走到 1。

#### 代码/API 逐项解释



- **分段函数**：warmup 区间线性增长，cosine 区间平滑衰减，超过 total_steps 后固定为 min_lr；三个边界都应单测。
- `progress`：把当前衰减位置归一化到 `[0,1]`；`0.5*(1+cos(pi*progress))` 从 1 平滑降到 0。
- `max(warmup_steps, 1)`：warmup 为 0 时避免除 0；此时 step 0 会直接进入后续分支。
- `math.cos(x)`：对单个 Python 标量求余弦并返回 `float`；这里 x 是归一化训练进度乘 pi，不需要 autograd。它不同于 tensor `.cos()`，后者会对每个张量元素计算并保留梯度关系。
- `math.pi`：Python 双精度圆周率常量；`progress` 从 0 到 1 时，角度从 0 到 pi，使 cosine multiplier 从 1 平滑下降到 0。

#### 输入与输出示例

- **输入/调用**：`warmup=100,total=1000,max_lr=1e-3`：step 0 为 0，step 50 为 `5e-4`，step 100 为 `1e-3`，之后按 cosine 衰减到 min_lr。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 31. Gradient Accumulation

**Problem.** Accumulate gradients over micro-batches, take one optimizer step, and return average loss.

**中文题意。** 用多个小 batch 模拟一个大 batch：每次 backward 只累加梯度，所有 micro-batches 完成后再 step。

### Reviewed Solution

#### 数学、公式与算法思路

$$
g=\nabla_\theta\frac1K\sum_{k=1}^{K}\mathcal{L}_k=\frac1K\sum_{k=1}^{K}\nabla_\theta\mathcal{L}_k
$$

- **公式 / 不变量。** 梯度累积用 K 个 micro-batch 模拟更大 batch；每个 loss 除以 K 才与大 batch 的平均梯度一致。
- **算法拆解。** 连续 K 次 forward/backward 不清梯度，第 K 次后 step 再 zero_grad；含 BatchNorm 时统计行为不完全等价。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def accumulated_step(model, optimizer, loss_fn, micro_batches):
    if not micro_batches:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("micro_batches cannot be empty")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    optimizer.zero_grad()
    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
    scale = 1.0 / len(micro_batches)
    # [变化示例] scale=未定义/旧值 -> scale=1.0 / len(micro_batches)；数值示例：6 / 3 -> 2。
    average_loss = 0.0
    # [变化示例] average_loss=未定义/旧值 -> average_loss=0.0；这是一次重新绑定/状态更新，右侧值决定新状态。
    for x, y in micro_batches:
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        raw_loss = loss_fn(model(x), y)
        # [变化示例] raw_loss=未定义/旧值 -> raw_loss 接收 loss_fn(model(x), y) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        # 先除以 micro-batch 数，使累积梯度成为平均梯度
        (raw_loss * scale).backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
        average_loss += raw_loss.detach().item() * scale
        # [变化示例] average_loss=旧值 -> average_loss=旧值 + (raw_loss.detach().item() * scale)；数值示例：2 + 3 -> 5，并写回 average_loss。
    optimizer.step()  # 所有梯度累积完成后只更新一次
    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
    return average_loss
    # [变化示例] 函数内部：average_loss；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** PyTorch 默认不会在 backward 时清空已有梯度，因此可自然累加。只有 micro-batch 大小相同时，简单除以数量才严格等价于大 batch mean；大小不同时应按样本数加权。

#### 代码/API 逐项解释

- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：4 个 micro-batch 各产生 loss；每次反传 `loss/4`，四次后参数 `.grad` 等价于大 batch 的平均梯度，再只调用一次 optimizer step。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 32. Top-k and Top-p Sampling

**Problem.** Apply temperature, top-k filtering, nucleus filtering, then sample one token.

**中文题意。** 调整 temperature 后，只保留 top-k 候选；再保留累计概率达到 top-p 的最小高概率集合，最后按过滤后的概率采样。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p_i\propto e^{z_i/T}\,\mathbf{1}[i\in\operatorname{TopK}\cap\operatorname{TopP}]
$$

- **公式 / 不变量。** temperature 控制分布尖锐度，top-k 限制候选数量，top-p 保留累计概率达到阈值的最小集合。
- **算法拆解。** 缩放 logits，先过滤再做稳定 Softmax，最后按概率采样；至少保留一个 token。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def sample_top_k_top_p(logits, top_k=0, top_p=1.0, temperature=1.0):
    if temperature <= 0 or not 0.0 < top_p <= 1.0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("invalid sampling parameters")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    filtered = logits.clone() / temperature  # clone 避免修改调用者输入
    # [变化示例] filtered=未定义/旧值 -> filtered=logits.clone() / temperature；数值示例：6 / 3 -> 2。
    if top_k > 0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        k = min(top_k, filtered.numel())
        # [变化示例] k=未定义/旧值 -> k 接收 min(top_k, filtered.numel()) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        threshold = filtered.topk(k).values[-1]
        # [变化示例] threshold=未定义/旧值 -> threshold=最大 k 个值/索引；例如 [0.2,0.9,0.4], k=2 -> [0.9,0.4]。
        filtered.masked_fill_(filtered < threshold, float("-inf"))
        # [变化示例] 执行状态：调用 filtered.masked_fill_(filtered < threshold, float("-inf")) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    if top_p < 1.0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        sorted_logits, ids = filtered.sort(descending=True)
        # [变化示例] sorted_logits, ids=未定义/旧值 -> sorted_logits, ids=排序后的值与原索引；例如 [3,1,2] 升序 -> values=[1,2,3], ids=[1,2,0]。
        probs = torch.softmax(sorted_logits, -1)
        # [变化示例] probs=未定义/旧值 -> probs=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
        # 保留使累计概率首次越过 p 的那个 token
        remove = probs.cumsum(-1) - probs > top_p
        # [变化示例] remove=未定义/旧值 -> remove=probs.cumsum(-1) - probs > top_p；数值示例：3 - 2 -> 1。
        sorted_logits.masked_fill_(remove, float("-inf"))
        # [变化示例] 执行状态：调用 sorted_logits.masked_fill_(remove, float("-inf")) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        filtered = torch.empty_like(filtered).scatter(0, ids, sorted_logits)
        # [变化示例] filtered=未定义/旧值 -> filtered=按 index 写回的新张量；例如 index=[2,0]、src=[7,8] -> 位置 2/0 分别变为 7/8。
    return torch.multinomial(torch.softmax(filtered, -1), 1).item()
    # [变化示例] 函数内部：按概率采样的索引；例如 [0.1,0.9] -> 更可能得到索引 1 -> 调用方收到该输出。
```

**中文解释。** 低 temperature 使分布更尖锐，高 temperature 增加随机性。Top-k 固定候选数量；top-p 根据当前分布动态决定候选数量。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.empty_like`：只分配与参照张量相同元数据的内存，不初始化数值；必须保证每个位置随后都会被写入，否则会读到未定义值。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.scatter(...)`：按照 `ids` 把排序空间中的 `sorted_logits` 写回原词表位置。这里 `dim=0`、index 与 source shape 相同，因此输出仍是 `(V,)`；未写位置来自 `empty_like`，所以必须保证 ids 是覆盖全部词表的完整排列。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- `.masked_fill_(...)`：`.masked_fill_` 是原地版本；若张量仍被 backward 需要，原地修改可能触发 autograd 版本错误。
- `.sort(...)`：`.sort(descending=True)` 返回排序值和原索引；top-p 需在排序空间累积后再映射回词表。
- `.cumsum(...)`：`.cumsum(dim)` 计算前缀和；nucleus sampling 用累计概率确定最小候选集合。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：logits `[4,3,2,1]`、top-k=2 时只保留前两项；若再用 top-p=0.8，则从排序后累计概率达到 0.8 的最小集合中采样一个索引。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 33. Beam Search

**Problem.** Expand the highest-scoring partial sequences and return the best completed sequence.

**中文题意。** 每一步保留累计 log-probability 最高的若干序列，遇到 EOS 后放入完成集合，最终返回最佳完成序列。

### Reviewed Solution

#### 数学、公式与算法思路

$$
s(y_{1:t})=\sum_{i=1}^{t}\log p(y_i\mid y_{<i},x)
$$

- **公式 / 不变量。** Beam Search 保留累计对数概率最高的 B 条部分序列，近似搜索最大概率序列。
- **算法拆解。** 每步展开 B×V 个候选，取全局 top-B，记录父 beam 和 token；遇到 EOS 后冻结并最终选最高分。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def beam_search(log_prob_fn, start_token, max_len, beam_width, eos_token):
    active, completed = [(0.0, [start_token])], []
    # [变化示例] active, completed=未定义/旧值 -> active, completed=[(0.0, [start_token])], []；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    while active and len(active[0][1]) < max_len:
        # [变化示例] 循环示例：条件 True -> 再执行一轮；条件 False -> 退出循环。
        candidates = []
        # [变化示例] candidates=未定义/旧值 -> candidates=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for score, seq in active:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            log_probs = log_prob_fn(torch.tensor(seq))
            # [变化示例] log_probs=未定义/旧值 -> log_probs 接收 log_prob_fn(torch.tensor(seq)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            width = min(beam_width, log_probs.numel())
            # [变化示例] width=未定义/旧值 -> width 接收 min(beam_width, log_probs.numel()) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            values, ids = log_probs.topk(width)
            # [变化示例] values, ids=未定义/旧值 -> values, ids=最大 k 个值/索引；例如 [0.2,0.9,0.4], k=2 -> [0.9,0.4]。
            for value, token in zip(values.tolist(), ids.tolist()):
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                item = (score + value, seq + [token])
                # [变化示例] item=未定义/旧值 -> item=score + value, seq + [token]；数值示例：2 + 3 -> 5。
                (completed if token == eos_token else candidates).append(item)
                # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
        # 只保留最好的 beam_width 个活跃序列
        active = sorted(candidates, key=lambda z: z[0], reverse=True)[:beam_width]
        # [变化示例] active=未定义/旧值 -> active 接收 sorted(candidates, key=lambda z: z[0], reverse=True)[:beam_... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        completed = sorted(completed, key=lambda z: z[0], reverse=True)[:beam_width]
        # [变化示例] completed=未定义/旧值 -> completed 接收 sorted(completed, key=lambda z: z[0], reverse=True)[:beam_w... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        if completed and (not active or completed[0][0] >= active[0][0]):
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            break
    pool = completed or active
    # [变化示例] pool=未定义/旧值 -> pool=completed or active；这是一次重新绑定/状态更新，右侧值决定新状态。
    return max(pool, key=lambda z: z[0])[1]
    # [变化示例] 函数内部：执行 max(pool, key=lambda z: z[0])[1] 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库原答案可能让未完成序列压过已完成序列，并把 `max_len` 当作扩展次数。这里将其定义为总长度并优先返回完成序列。实际生成常增加 length penalty，避免偏爱短句。

#### 代码/API 逐项解释

- `torch.tensor`：把 Python 标量/列表复制成张量；dtype 通常由输入推断，训练代码里应按需要显式指定。
- `.numel(...)`：`.numel()` 返回总元素数；可用于按参数量归一化或恢复原 shape。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.tolist(...)`：`.tolist()` 把张量同步复制为 Python 列表；适合控制流演示，不适合 GPU 热路径。

#### 输入与输出示例

- **输入/调用**：start=`<bos>`、beam width=2；第一步保留累计 log-prob 最好的两个序列，遇到 `<eos>` 的 beam 放入 completed，最终返回 token 序列和分数。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 34. Speculative Decoding Acceptance

**Problem.** Accept draft token `t` with probability `min(1,p(t)/q(t))`; on rejection sample from normalized `max(p-q,0)`.

**中文题意。** 小模型提出 token，大模型按概率比接受；若拒绝，则从目标分布与草稿分布的正残差中采样纠正 token。

### Reviewed Solution

#### 数学、公式与算法思路

$$
a_t=\min\!\left(1,\frac{p_t(y_t)}{q_t(y_t)}\right)
$$

- **公式 / 不变量。** 推测解码用小模型 q 提案、大模型 p 验证；接受概率保证最终样本仍服从目标分布 p。
- **算法拆解。** 按顺序接受草稿 token，首次拒绝后从修正分布采样并停止该轮；概率比必须防除零并裁剪到 1。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def speculative_decode(target_probs, draft_probs, draft_tokens):
    accepted = []
    # [变化示例] accepted=未定义/旧值 -> accepted=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    for i, token_tensor in enumerate(draft_tokens):
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        token = token_tensor.item()
        # [变化示例] token=未定义/旧值 -> token=单元素 tensor 转成 Python 标量；例如 tensor(2.5) -> 2.5。
        p = target_probs[i, token]
        # [变化示例] p=未定义/旧值 -> p=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        q = draft_probs[i, token].clamp_min(1e-10)
        # [变化示例] q=未定义/旧值 -> q=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        accept_prob = torch.minimum(p / q, p.new_tensor(1.0))
        # [变化示例] accept_prob=未定义/旧值 -> accept_prob=逐元素较小/较大值；例如 minimum([2,5],[3,4]) -> [2,4]。
        if torch.rand((), device=p.device) < accept_prob:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            accepted.append(token)
            # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
            continue
        # 拒绝后用校正分布采样，并结束本轮 speculation
        residual = (target_probs[i] - draft_probs[i]).clamp_min(0)
        # [变化示例] residual=未定义/旧值 -> residual=max(左值-右值,0)；例如 [0.7,0.2]-[0.4,0.5] -> [0.3,0]。
        if residual.sum() <= 0:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            residual = target_probs[i]
            # [变化示例] residual=未定义/旧值 -> residual=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        accepted.append(torch.multinomial(residual / residual.sum(), 1).item())
        # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
        break
    return accepted
    # [变化示例] 函数内部：accepted；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** 该接受/纠正规则保证最终采样仍服从 target model，而不是 draft model。完整算法在所有 K 个草稿均接受后，还会从 target 多采样一个 token；原题只要求接受/拒绝部分。

#### 代码/API 逐项解释

- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `torch.rand`：从 `[0,1)` 均匀分布创建张量；若参与概率判断，要确认随机张量与概率张量位于同一 device。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.new_tensor(...)`：`.new_tensor(data)` 以当前张量为模板创建常量，避免 CPU/GPU 与 dtype 不一致。

#### 输入与输出示例

- **输入/调用**：draft token 的概率 q=0.4、target 概率 p=0.2，接受率 `min(1,p/q)=0.5`；拒绝时从校正分布采样替代 token。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 35. Byte-Pair Encoding

**Problem.** Train a simple BPE tokenizer by repeatedly merging the most frequent adjacent symbol pair.

**中文题意。** 将词拆成字符加词尾标记，统计相邻 token pair 的加权频率，反复合并最高频 pair；编码时按学习顺序应用 merges。

### Reviewed Solution

#### 数学、公式与算法思路

$$
(a,b)^*=\arg\max_{(a,b)}\operatorname{count}(a,b)
$$

- **公式 / 不变量。** BPE 反复合并语料中最高频的相邻符号对，逐步从字符构造子词词表。
- **算法拆解。** 统计所有相邻 pair，选最高频 pair 全局合并，更新词表并重复；并列时必须有确定性规则。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class SimpleBPE:
    def __init__(self):
        self.merges = []
        # [变化示例] self.merges=未定义/旧值 -> self.merges=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

    def train(self, corpus, num_merges):
        vocab = {}
        # [变化示例] vocab=未定义/旧值 -> vocab={}；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for word in corpus:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            symbols = tuple(word) + ("</w>",)
            # [变化示例] symbols=未定义/旧值 -> symbols=tuple(word) + ("</w>",)；数值示例：2 + 3 -> 5。
            vocab[symbols] = vocab.get(symbols, 0) + 1
            # [变化示例] vocab[symbols]=未定义/旧值 -> vocab[symbols]=vocab.get(symbols, 0) + 1；数值示例：2 + 3 -> 5。
        self.merges = []
        # [变化示例] self.merges=未定义/旧值 -> self.merges=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for _ in range(num_merges):
            # [变化示例] 循环示例：range(num_merges) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            counts = {}
            # [变化示例] counts=未定义/旧值 -> counts={}；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
            for symbols, freq in vocab.items():
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                for pair in zip(symbols, symbols[1:]):
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                    counts[pair] = counts.get(pair, 0) + freq
                    # [变化示例] counts[pair]=未定义/旧值 -> counts[pair]=counts.get(pair, 0) + freq；数值示例：2 + 3 -> 5。
            if not counts:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                break
            best = max(counts, key=counts.get)
            # [变化示例] best=未定义/旧值 -> best 接收 max(counts, key=counts.get) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            self.merges.append(best)
            # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
            new_vocab = {}
            # [变化示例] new_vocab=未定义/旧值 -> new_vocab={}；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
            for symbols, freq in vocab.items():
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                merged, i = [], 0
                # [变化示例] merged, i=未定义/旧值 -> merged, i=[], 0；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
                while i < len(symbols):
                    # [变化示例] 循环示例：条件 True -> 再执行一轮；条件 False -> 退出循环。
                    if i+1 < len(symbols) and (symbols[i], symbols[i+1]) == best:
                        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                        merged.append(symbols[i] + symbols[i+1]); i += 2
                        # [变化示例] merged.append(symbols[i] + symbols[i+1]); i=旧值 -> merged.append(symbols[i] + symbols[i+1]); i=旧值 + (2)；数值示例：2 + 3 -> 5，并写回 merged.append(symbols[i] + symbols[i+1]); i。
                    else:
                        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                        merged.append(symbols[i]); i += 1
                        # [变化示例] merged.append(symbols[i]); i=旧值 -> merged.append(symbols[i]); i=旧值 + (1)；数值示例：2 + 3 -> 5，并写回 merged.append(symbols[i]); i。
                key = tuple(merged)
                # [变化示例] key=未定义/旧值 -> key 接收 tuple(merged) 的返回值；用 shape/dtype/device 与示例输入核对变化。
                # 合并后相同的词形必须累加频率，不能覆盖
                new_vocab[key] = new_vocab.get(key, 0) + freq
                # [变化示例] new_vocab[key]=未定义/旧值 -> new_vocab[key]=new_vocab.get(key, 0) + freq；数值示例：2 + 3 -> 5。
            vocab = new_vocab
            # [变化示例] vocab=未定义/旧值 -> vocab=new_vocab；这是一次重新绑定/状态更新，右侧值决定新状态。

    def encode(self, text):
        result = []
        # [变化示例] result=未定义/旧值 -> result=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for word in text.split():
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            symbols = list(word) + ["</w>"]
            # [变化示例] symbols=未定义/旧值 -> symbols=list(word) + ["</w>"]；数值示例：2 + 3 -> 5。
            for left, right in self.merges:
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                merged, i = [], 0
                # [变化示例] merged, i=未定义/旧值 -> merged, i=[], 0；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
                while i < len(symbols):
                    # [变化示例] 循环示例：条件 True -> 再执行一轮；条件 False -> 退出循环。
                    if i+1 < len(symbols) and symbols[i:i+2] == [left, right]:
                    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                        merged.append(left + right); i += 2
                        # [变化示例] merged.append(left + right); i=旧值 -> merged.append(left + right); i=旧值 + (2)；数值示例：2 + 3 -> 5，并写回 merged.append(left + right); i。
                    else:
                        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                        merged.append(symbols[i]); i += 1
                        # [变化示例] merged.append(symbols[i]); i=旧值 -> merged.append(symbols[i]); i=旧值 + (1)；数值示例：2 + 3 -> 5，并写回 merged.append(symbols[i]); i。
                symbols = merged
                # [变化示例] symbols=未定义/旧值 -> symbols=merged；这是一次重新绑定/状态更新，右侧值决定新状态。
            result.extend(symbols)
            # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
        return result
        # [变化示例] 函数内部：result；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** Pair 频率必须乘词频，而非只统计不同词形。仓库答案在合并后可能覆盖相同 key 的频率；这里改为累加。真实 GPT tokenizer 通常基于 bytes，并处理空格和特殊 token。

#### 代码/API 逐项解释

- `.split(...)`：`.split(size_or_sections,dim)` 按固定长度或长度列表拆分；与 chunk 的“块数”语义不同。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：词频 `{low:5, lower:2}` 拆成字符后，若 `(l,o)` 最频繁则合并为 `lo`；输出是 merge 规则列表和更新后的词符序列。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 36. INT8 Quantized Linear

**Problem.** Quantize each output-channel weight row to INT8, store scales and quantized weights as buffers, then dequantize in forward.

**中文题意。** 对每个输出通道独立计算 scale，把浮点权重量化为 INT8；前向时反量化并执行 Linear。

### Reviewed Solution

#### 数学、公式与算法思路

$$
q=\operatorname{clip}\!\left(\operatorname{round}(x/s)+z,q_{min},q_{max}\right),\qquad \hat x=s(q-z)
$$

- **公式 / 不变量。** 线性量化用 scale 和 zero-point 把浮点映射到 INT8；反量化存在由舍入和裁剪造成的误差。
- **算法拆解。** 量化输入/权重，使用整数累加，再乘组合 scale 并加浮点 bias；对称量化常令 z=0。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class Int8Linear(nn.Module):
    def __init__(self, weight, bias=None):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        # 每一行一个 scale，保持不同输出通道的动态范围
        scale = (weight.abs().amax(dim=1, keepdim=True) / 127.0).clamp_min(1e-10)
        # [变化示例] scale=未定义/旧值 -> scale 接收 (weight.abs().amax(dim=1, keepdim=True) / 127.0).clamp_min(... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        quantized = (weight / scale).round().clamp(-127, 127).to(torch.int8)
        # [变化示例] quantized=未定义/旧值 -> quantized 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        self.register_buffer("weight_int8", quantized)
        # [变化示例] 执行状态：调用 self.register_buffer("weight_int8", quantized) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.register_buffer("scale", scale)
        # [变化示例] 执行状态：调用 self.register_buffer("scale", scale) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.bias = nn.Parameter(bias.clone()) if bias is not None else None
        # [变化示例] self.bias=未定义/旧值 -> self.bias=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。

    def forward(self, x):
        # INT8 -> 输入 dtype；(Dout,Din) 用 F.linear 自动转置
        weight = self.weight_int8.to(x.dtype) * self.scale.to(x.dtype)
        # [变化示例] weight=未定义/旧值 -> weight=self.weight_int8.to(x.dtype) * self.scale.to(x.dtype)；数值示例：2 * 3 -> 6。
        return F.linear(x, weight, self.bias)
        # [变化示例] 函数内部：执行 F.linear(x, weight, self.bias) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 对称 INT8 使用 `[-127,127]`，无需使用不对称的 `-128`。这份教学实现会完整反量化，因此展示的是存储与量化误差，不会带来真正 INT8 kernel 的计算加速。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.int8`：8 位有符号整数 dtype，范围 `[-128,127]`；量化时需配合 scale 才能近似还原浮点值。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `F.linear`：执行 `x @ weight.T + bias`；权重 shape 是 `(out_features,in_features)`。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.register_buffer(...)`：`.register_buffer(name,tensor)` 注册不训练但需随模型迁移/保存的状态，如位置编码或 running stats。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。

- `.round(...)`：`.round()` 逐元素取最近整数；浮点权重量化到 int8 前先除 scale、round、再 clamp。

#### 输入与输出示例

- **输入/调用**：浮点权重 `(32,64)` 量化成 int8 权重与 scale；输入 `(4,64)` 反量化/计算后输出 `(4,32)`，近似而非逐位等于浮点层。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 37. DPO Loss

**Problem.** Compute Direct Preference Optimization loss from policy/reference log-probabilities for chosen and rejected responses.

**中文题意。** 比较 policy 对 chosen/rejected 的偏好差值与 reference 的偏好差值，通过 logistic loss 提升 chosen 的相对概率。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}_{DPO}=-\log\sigma\!\left(\beta\left[\log\frac{\pi_\theta(y_w|x)}{\pi_{ref}(y_w|x)}-\log\frac{\pi_\theta(y_l|x)}{\pi_{ref}(y_l|x)}\right]\right)
$$

- **公式 / 不变量。** DPO 鼓励策略相对参考模型更偏好 chosen 而非 rejected，不需要显式训练奖励模型。
- **算法拆解。** 分别求 chosen/rejected 的策略与参考序列 log-prob，构造相对 margin，再用 log-sigmoid 得到稳定损失。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def dpo_loss(policy_chosen_logps, policy_rejected_logps,
             ref_chosen_logps, ref_rejected_logps, beta=0.1):
    # policy 希望 chosen-rejected margin 比 reference 更大
    policy_margin = policy_chosen_logps - policy_rejected_logps
    # [变化示例] policy_margin=未定义/旧值 -> policy_margin=policy_chosen_logps - policy_rejected_logps；数值示例：3 - 2 -> 1。
    ref_margin = ref_chosen_logps.detach() - ref_rejected_logps.detach()
    # [变化示例] ref_margin=未定义/旧值 -> ref_margin=ref_chosen_logps.detach() - ref_rejected_logps.detach()；数值示例：3 - 2 -> 1。
    logits = beta * (policy_margin - ref_margin)
    # [变化示例] logits=未定义/旧值 -> logits=beta * (policy_margin - ref_margin)；数值示例：2 * 3 -> 6。
    return -F.logsigmoid(logits).mean()
    # [变化示例] 函数内部：执行 -F.logsigmoid(logits).mean() 得到结果 -> 调用方收到该输出。
```

**中文解释。** DPO 不显式训练 reward model 或执行在线 RL。`beta` 控制相对 reference 的移动强度。Reference 是固定基准，因此应 detach。

#### 代码/API 逐项解释

- `F.logsigmoid`：稳定计算 `log(sigmoid(x))`，比先 sigmoid 再 log 更不容易在大负数处下溢。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：chosen/rejected policy log-prob 差为 1.2/0.3，reference 差为 0.7/0.4；margin=`0.6`，beta=0.1，loss=`-logsigmoid(0.06)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 38. Simplified GRPO Loss

**Problem.** Normalize rewards within each prompt group and compute negative advantage-weighted policy log-probability.

**中文题意。** 对同一 prompt 生成的多个回答做组内 reward 标准化，作为 advantage，再使用策略梯度目标更新回答概率。

### Reviewed Solution

#### 数学、公式与算法思路

$$
A_i=\frac{r_i-\mu_G}{\sigma_G+\epsilon},\qquad \mathcal{L}=-\frac1G\sum_i\min(\rho_iA_i,\operatorname{clip}(\rho_i,1-\epsilon,1+\epsilon)A_i)
$$

- **公式 / 不变量。** GRPO 用同一 prompt 的组内奖励标准化作 advantage，省去独立 value model，并用 clipped ratio 限制更新。
- **算法拆解。** 按组标准化奖励，计算新旧策略概率比，取 clipped surrogate；标准差很小时 epsilon 很关键。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def grpo_loss(logps, rewards, group_ids, eps=1e-5):
    advantages = torch.empty_like(rewards)
    # [变化示例] advantages=未定义/旧值 -> advantages 接收 torch.empty_like(rewards) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    for group_id in group_ids.unique():
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        selected = group_ids == group_id
        # [变化示例] selected=未定义/旧值 -> 链式赋值 selected=group_ids == group_id；等号两侧目标最终引用同一给定值。
        r = rewards[selected]
        # [变化示例] r=未定义/旧值 -> r=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        # 每个 prompt 组独立计算 baseline 和尺度
        advantages[selected] = (r - r.mean()) / (r.std(unbiased=False) + eps)
        # [变化示例] advantages[selected]=未定义/旧值 -> advantages[selected]=(r - r.mean()) / (r.std(unbiased=False) + eps)；数值示例：6 / 3 -> 2。
    # reward/advantage 不参与梯度，只有 logps 回传到 policy
    return -(advantages.detach() * logps).mean()
    # [变化示例] 函数内部：数值相同但与当前 autograd 图断开的 tensor；grad_fn -> None -> 调用方收到该输出。
```

**中文解释。** 组内均值充当 prompt-specific baseline，可降低梯度方差。若组内 reward 全相同，advantage 为 0。严格来说原题实现的是简化的 group-normalized REINFORCE；完整 GRPO 常包含 old-policy ratio、clipping、KL、token mask 等。

#### 代码/API 逐项解释

- `torch.empty_like`：只分配与参照张量相同元数据的内存，不初始化数值；必须保证每个位置随后都会被写入，否则会读到未定义值。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.unique(...)`：`.unique()` 返回去重元素；分组算法中可枚举实际出现的 group id。
- `.std(...)`：`.std(dim)` 计算标准差；组内 advantage 标准化时应加 epsilon，并明确 correction 约定。

#### 输入与输出示例

- **输入/调用**：同一 prompt 的 4 个 reward `[1,2,3,4]` 会在组内标准化成正负 advantage；输出为所有 token/sample surrogate 的平均标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 39. PPO Clipped Loss

**Problem.** Compute the clipped PPO surrogate objective from new/old log-probabilities and advantages.

**中文题意。** 用 `exp(new_logp-old_logp)` 得到重要性采样比率，将比率限制在 `[1-eps,1+eps]`，取更保守的目标。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}_{clip}=-\mathbb{E}\left[\min\left(r_tA_t,\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)A_t\right)\right]
$$

- **公式 / 不变量。** PPO 在策略改进项和裁剪项中取较小者，阻止一次更新把动作概率推得过远。
- **算法拆解。** 用 log-prob 差指数化得到 ratio，按 advantage 符号理解 min 的约束方向，再对有效 token 求均值。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def ppo_loss(new_logps, old_logps, advantages, clip_ratio=0.2):
    if clip_ratio < 0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("clip_ratio must be non-negative")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    ratio = torch.exp(new_logps - old_logps.detach())
    # [变化示例] ratio=未定义/旧值 -> ratio=逐元素指数；例如 [0,1] -> [1,2.718]。
    advantage = advantages.detach()
    # [变化示例] advantage=未定义/旧值 -> advantage=数值相同但与当前 autograd 图断开的 tensor；grad_fn -> None。
    unclipped = ratio * advantage
    # [变化示例] unclipped=未定义/旧值 -> unclipped=ratio * advantage；数值示例：2 * 3 -> 6。
    clipped = ratio.clamp(1.0-clip_ratio, 1.0+clip_ratio) * advantage
    # [变化示例] clipped=未定义/旧值 -> clipped=ratio.clamp(1.0-clip_ratio, 1.0+clip_ratio) * advantage；数值示例：2 * 3 -> 6。
    # 取 minimum，再取负号转成要最小化的 loss
    return -torch.minimum(unclipped, clipped).mean()
    # [变化示例] 函数内部：执行 -torch.minimum(unclipped, clipped).mean() 得到结果 -> 调用方收到该输出。
```

**中文解释。** 对正 advantage，限制概率增加过多；对负 advantage，限制概率下降过多。这里只实现 policy loss，完整 PPO 还包括 value loss、entropy bonus、mask 和 KL/clip fraction 监控。

#### 代码/API 逐项解释

- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：old log-prob=-1、new=-0.7，ratio=`exp(0.3)=1.35`；clip=0.2 时正 advantage 使用上限 1.2，避免单步更新过大。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 40. Linear Regression Three Ways

**Problem.** Fit `y=Xw+b` using least squares, manual gradient descent, and `nn.Linear` with autograd.

**中文题意。** 用闭式最小二乘、手写 MSE 梯度下降、PyTorch Linear 三种方式求线性回归参数。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\hat y=Xw+b,\qquad \mathcal{L}_{MSE}=\frac1N\lVert\hat y-y\rVert_2^2
$$

- **公式 / 不变量。** 线性回归无论手写梯度、autograd 还是 nn.Module，都在优化同一个凸二次目标。
- **算法拆解。** forward 得预测，计算 MSE，求梯度并更新；比较三种实现时应使用相同数据、初始化和学习率。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class LinearRegression:
    def closed_form(self, X, y):
        n, d = X.shape
        # [变化示例] n, d=未定义/旧值 -> n, d=X.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        # 添加全 1 列，把 bias 合并进 theta；new_ones 保持 device/dtype
        X_aug = torch.cat([X, X.new_ones(n, 1)], dim=1)
        # [变化示例] X_aug=未定义/旧值 -> X_aug 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。
        theta = torch.linalg.lstsq(X_aug, y).solution
        # [变化示例] theta=未定义/旧值 -> theta 接收 torch.linalg.lstsq(X_aug, y).solution 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return theta[:d].detach(), theta[d].detach()
        # [变化示例] 函数内部：索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,) -> 调用方收到该输出。

    def gradient_descent(self, X, y, lr=0.01, steps=1000):
        n, d = X.shape
        # [变化示例] n, d=未定义/旧值 -> n, d=X.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        w, b = X.new_zeros(d), X.new_zeros(())
        # [变化示例] w, b=未定义/旧值 -> w, b=按给定 shape 创建且继承模板 dtype/device；例如模板在 CUDA float16 -> 新张量也在 CUDA float16。
        for _ in range(steps):
            # [变化示例] 循环示例：range(steps) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            error = X @ w + b - y
            # [变化示例] error=未定义/旧值 -> error=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
            # MSE 对 w/b 的解析梯度，不使用 autograd
            w = w - lr * (2.0/n) * (X.T @ error)
            # [变化示例] w=未定义/旧值 -> w=w - lr * (2.0/n) * (X.T @ error)；数值示例：3 - 2 -> 1。
            b = b - lr * (2.0/n) * error.sum()
            # [变化示例] b=未定义/旧值 -> b=b - lr * (2.0/n) * error.sum()；数值示例：3 - 2 -> 1。
        return w, b
        # [变化示例] 函数内部：tuple (w, b)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。

    def nn_linear(self, X, y, lr=0.01, steps=1000):
        layer = nn.Linear(X.size(1), 1, device=X.device, dtype=X.dtype)
        # [变化示例] layer=未定义/旧值 -> layer=线性映射模块；输入最后一维 X.size(1) -> 输出最后一维 1。
        optimizer = torch.optim.SGD(layer.parameters(), lr=lr)
        # [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
        for _ in range(steps):
            # [变化示例] 循环示例：range(steps) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            optimizer.zero_grad()
            # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
            loss = F.mse_loss(layer(X).squeeze(-1), y)
            # [变化示例] loss=未定义/旧值 -> loss=均方误差；例如 prediction=[1,3]、target=[1,1] -> mean([0,4])=2。
            loss.backward()
            # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
            optimizer.step()
            # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
        return (layer.weight.detach().squeeze(0).clone(),
                layer.bias.detach().squeeze(0).clone())
        # [变化示例] 函数内部：独立副本；数值相同，但后续原地修改不再共享同一 storage -> 调用方收到该输出。
```

**中文解释。** `lstsq` 比显式求 `(X^TX)^-1` 更稳定，也能处理秩不足。手写梯度展示 MSE 数学；`nn.Linear` 展示 autograd 和 optimizer 工作流。仓库答案创建 CPU tensor，这里修正为跟随 X 的 device/dtype。

#### 代码/API 逐项解释

- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.linalg.lstsq`：求最小二乘解 `argmin_theta ||X_aug @ theta - y||_2`，比显式计算逆矩阵更稳定，也能处理超定或秩不足系统。返回的是包含 `solution`、`residuals`、`rank`、`singular_values` 的结果对象；此处 `solution.shape=(D+1,)`，前 D 项是权重，最后一项是 bias。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.optim.SGD`：接收可训练参数迭代器并维护学习率、momentum、weight decay 等优化状态；最基础更新是 `param -= lr * grad`。`zero_grad -> backward -> step` 的顺序不能颠倒，且 optimizer 只会更新构造时传入的已注册参数。
- `F.mse_loss`：均方误差；默认对所有元素取 mean，回归时要确认 reduction 是否符合样本权重语义。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.new_ones(...)`：`.new_ones(shape)` 继承当前张量的 dtype/device 创建全 1 张量。
- `.parameters(...)`：`.parameters()` 递归迭代已注册参数；普通 Tensor 或未注册容器里的模块不会自动出现。

#### 输入与输出示例

- **输入/调用**：`X.shape=(100,3)`、`y.shape=(100,1)`；闭式解、手写梯度下降和 `nn.Linear` 都输出 `(100,1)` 预测，可比较参数和 MSE。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 41. OPD Loss

**Problem.** Compute teacher-weighted reverse KL `KL(student || teacher)` with optional token mask and temperature.

**中文题意。** 对一个或多个 teacher，计算 student 到 teacher 的反向 KL；按 teacher 权重组合，支持忽略 padding token 和温度蒸馏。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}_{OPD}=-\log\sigma\!\left(\beta(\Delta_\theta-\Delta_{ref})\right),\qquad \Delta=\log p(y_w|x)-\log p(y_l|x)
$$

- **公式 / 不变量。** 偏好目标关注 chosen 与 rejected 的序列对数概率差，并用参考模型校正策略漂移。
- **算法拆解。** 先按有效 token 汇总序列 log-prob，再形成策略/参考 margin 差；padding 位置不能计入。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def opd_loss(student_logits, teacher_logits, teacher_weights=None,
             mask=None, temperature=1.0):
    if temperature <= 0:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        raise ValueError("temperature must be positive")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
    # 单 teacher (...,V) -> (1,...,V)，统一 teacher 维度
    if teacher_logits.dim() == student_logits.dim():
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        teacher_logits = teacher_logits.unsqueeze(0)
        # [变化示例] teacher_logits=未定义/旧值 -> teacher_logits 新增长度为 1 的轴；例如 (B,D) -> (B,1,D)，元素值不变。
    elif teacher_logits.dim() != student_logits.dim() + 1:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        raise ValueError("invalid teacher shape")
        # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。

    t = float(temperature)
    # [变化示例] t=未定义/旧值 -> t 接收 float(temperature) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    student_logp = F.log_softmax(student_logits / t, dim=-1)
    # [变化示例] student_logp=未定义/旧值 -> student_logp=log 概率；例如 logits=[0,0] -> 约 [-0.693,-0.693]。
    student_prob = student_logp.exp()
    # [变化示例] student_prob=未定义/旧值 -> student_prob=逐元素指数；例如 [0,1] -> [1,2.718]。
    teacher_logp = F.log_softmax(teacher_logits.detach() / t, dim=-1)
    # [变化示例] teacher_logp=未定义/旧值 -> teacher_logp=数值相同但与当前 autograd 图断开的 tensor；grad_fn -> None。
    # 对 vocab 求和：sum_v p_s(v)[log p_s(v)-log p_t(v)]
    kl = (student_prob.unsqueeze(0) *
          (student_logp.unsqueeze(0) - teacher_logp)).sum(-1)
    # [变化示例] kl=未定义/旧值 -> kl 接收 (student_prob.unsqueeze(0) * (student_logp.unsqueeze(0) - t... 的返回值；用 shape/dtype/device 与示例输入核对变化。

    teacher_count = kl.size(0)
    # [变化示例] teacher_count=未定义/旧值 -> teacher_count=指定轴长度；例如 shape=(2,3,4)，size(0) -> 对应维长度。
    if teacher_weights is None:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        weights = kl.new_full((teacher_count,), 1.0 / teacher_count)
        # [变化示例] weights=未定义/旧值 -> weights=按给定 shape 创建且继承模板 dtype/device；例如模板在 CUDA float16 -> 新张量也在 CUDA float16。
    else:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        weights = teacher_weights.to(device=kl.device, dtype=kl.dtype)
        # [变化示例] weights=未定义/旧值 -> weights 移到目标 device并按参数转换 dtype；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        if (weights.shape != (teacher_count,) or not torch.isfinite(weights).all()
                or (weights < 0).any() or weights.sum() <= 0):
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("teacher weights 必须有限、非负且总和为正")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        weights = weights / weights.sum()
        # [变化示例] weights=未定义/旧值 -> weights=weights / weights.sum()；数值示例：6 / 3 -> 2。
    shape = (teacher_count,) + (1,) * (kl.dim()-1)
    # [变化示例] shape=未定义/旧值 -> shape=(teacher_count,) + (1,) * (kl.dim()-1)；数值示例：2 + 3 -> 5。
    per_token = (weights.view(shape) * kl).sum(0)
    # [变化示例] per_token=未定义/旧值 -> per_token 接收 (weights.view(shape) * kl).sum(0) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    if mask is None:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        loss = per_token.mean()
        # [变化示例] loss=未定义/旧值 -> loss=沿指定维求均值；例如 [1,2,3] -> 2。
    else:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        mask = mask.to(device=per_token.device, dtype=per_token.dtype)
        # [变化示例] mask=未定义/旧值 -> mask 移到目标 device并按参数转换 dtype；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        # 只平均有效 token，clamp 防止全 mask 时除零
        loss = (per_token * mask).sum() / mask.sum().clamp_min(1.0)
        # [变化示例] loss=未定义/旧值 -> loss=(per_token * mask).sum() / mask.sum().clamp_min(1.0)；数值示例：6 / 3 -> 2。
    return loss * t**2
    # [变化示例] 函数内部：loss * t**2；数值示例：2 ** 3 -> 8 -> 调用方收到该输出。
```

**中文解释。** Reverse KL 的期望由 student 分布加权，倾向于 mode-seeking：student 若把概率放在 teacher 几乎不支持的位置，会受到强惩罚。Teacher logits 必须 detach。乘 `T^2` 用于补偿温度导致的梯度缩放，是蒸馏中的常见约定。

#### 代码/API 逐项解释

- `F.log_softmax`：稳定地同时完成 softmax 和 log；NLL、DPO、蒸馏等需要 log-prob 时应优先使用。
- `torch.isfinite`：检查元素既不是 NaN 也不是正负 Inf，适合在 loss 前做数值健康检查。
- `.unsqueeze(...)`：`.unsqueeze(dim)` 插入长度为 1 的轴，不复制数据；常用于对齐 broadcasting 维度。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.new_full(...)`：`.new_full(shape,value)` 以当前张量为模板创建常数张量，避免设备和精度不匹配。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。
- `.all(...)`：`.all()` 判断是否所有元素均为 True；可用于检查整个 batch 是否有限或满足约束。
- `.any(...)`：`.any()` 判断是否至少有一个 True；空 cluster 检查可用它决定重算还是保留旧中心。

#### 输入与输出示例

- **输入/调用**：student/teacher logits 均为 `(B,S,V)`；先转为 log-prob，按 teacher 权重对 token loss 加权，输出一个有限标量 loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

---

## 最后复习：四类核心能力

| 类别 | 重点问题 | 你应该能口述的主线 |
|---|---|---|
| PyTorch 基础 | 01-04, 07-08, 15-22 | broadcasting、autograd、normalization、参数与梯度 |
| Transformer | 05-06, 09-14, 23-25 | Q/K/V shapes、mask、拆头、KV cache、位置编码 |
| LLM 系统 | 26-36 | PEFT、MoE、decoding、tokenization、quantization |
| Alignment | 37-39, 41 | preference margin、advantage、ratio clipping、KL distillation |

## 静态审查说明

- 41 道题均已包含，且每题只出现一次。
- 答案以原题约束为基础，但修复了 dtype/device、边界参数、BPE 频率覆盖、beam completion、dropout `p=1` 等问题。
- Sliding-window 与本题 Flash Attention 是算法教学版本，不代表生产级 sparse/fused kernel 性能。
- 第 38 题是简化 GRPO 目标，不等同于完整训练框架中的 GRPO。
- 按要求没有运行 notebook 或答案代码。

---

# TorchLeet 续篇（42-102）

> 来源：`TorchLeet-main/TorchLeet-main`。以下 61 题按实际 notebook 文件配对，而不是只依赖仓库中部分过时的路径索引。代码采用静态审查后的版本。

## 42. TorchLeet BPE

**Problem.** Build a vocabulary, count adjacent symbol pairs, merge the most frequent pair, and repeat for a fixed number of merges.

**中文题意。** 从词频表开始，把单词拆成字符和 `</w>`，反复统计并合并最高频相邻符号对。

### Reviewed Solution

#### 数学、公式与算法思路

$$
(u,v)^*=\arg\max_{(u,v)}f(u,v),\qquad vocab\leftarrow vocab\cup\{uv\}
$$

- **公式 / 不变量。** 该 BPE 实现的核心仍是最高频 pair 合并；训练规则与编码时的 merge 顺序必须一致。
- **算法拆解。** 预分词、统计 pair、确定性选最大值、合并并记录 rank；编码新文本时按 rank 重放合并。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
from collections import Counter

def byte_pair_encoding(corpus, num_merges=10):
    # 原 solution 仍是省略号；这里补全可学习的核心算法
    vocab = Counter(tuple(word) + ("</w>",) for word in corpus)
    # [变化示例] vocab=未定义/旧值 -> vocab 接收 Counter(tuple(word) + ("</w>",) for word in corpus) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    merges = []
    # [变化示例] merges=未定义/旧值 -> merges=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    for _ in range(num_merges):
        # [变化示例] 循环示例：range(num_merges) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        pairs = Counter()
        # [变化示例] pairs=未定义/旧值 -> pairs=Counter()；这是一次重新绑定/状态更新，右侧值决定新状态。
        for symbols, freq in vocab.items():
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            # 同一单词中同一个 pair 可能出现多次，不能用 dict comprehension 覆盖
            for pair in zip(symbols, symbols[1:]):
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                pairs[pair] += freq
                # [变化示例] pairs[pair]=旧值 -> pairs[pair]=旧值 + (freq)；数值示例：2 + 3 -> 5，并写回 pairs[pair]。
        if not pairs:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            break
        best = pairs.most_common(1)[0][0]
        # [变化示例] best=未定义/旧值 -> best 接收 pairs.most_common(1)[0][0] 的返回值；用 shape/dtype/device 与示例输入核对变化。
        merges.append(best)
        # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
        new_vocab = Counter()
        # [变化示例] new_vocab=未定义/旧值 -> new_vocab=Counter()；这是一次重新绑定/状态更新，右侧值决定新状态。
        for symbols, freq in vocab.items():
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            out, i = [], 0
            # [变化示例] out, i=未定义/旧值 -> out, i=[], 0；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
            while i < len(symbols):
                # [变化示例] 循环示例：条件 True -> 再执行一轮；条件 False -> 退出循环。
                if i+1 < len(symbols) and symbols[i:i+2] == best:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                    out.append(best[0] + best[1]); i += 2
                    # [变化示例] out.append(best[0] + best[1]); i=旧值 -> out.append(best[0] + best[1]); i=旧值 + (2)；数值示例：2 + 3 -> 5，并写回 out.append(best[0] + best[1]); i。
                else:
                    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                    out.append(symbols[i]); i += 1
                    # [变化示例] out.append(symbols[i]); i=旧值 -> out.append(symbols[i]); i=旧值 + (1)；数值示例：2 + 3 -> 5，并写回 out.append(symbols[i]); i。
            new_vocab[tuple(out)] += freq
            # [变化示例] new_vocab[tuple(out)]=旧值 -> new_vocab[tuple(out)]=旧值 + (freq)；数值示例：2 + 3 -> 5，并写回 new_vocab[tuple(out)]。
        vocab = new_vocab
        # [变化示例] vocab=未定义/旧值 -> vocab=new_vocab；这是一次重新绑定/状态更新，右侧值决定新状态。
    return dict(vocab), merges
    # [变化示例] 函数内部：执行 dict(vocab), merges 得到结果 -> 调用方收到该输出。
```

**中文解释。** 原答案 notebook 中函数体仍为 `...`，不能算完成解。修正版保留词频，并在不同词形合并到同一个 key 时累加频率。

#### 代码/API 逐项解释

- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `Counter(tuple(word) + ('</w>',) for word in corpus)`：把每个词拆成不可变 symbol tuple，并统计重复词频；`</w>` 保留词边界。
- `.most_common(1)`：返回频率最高的一个 `(pair,count)`；代码的 `[0][0]` 取其中 pair。
- **merge 输出**：每轮必须把旧 vocab 的词频累加到 new vocab，不能因多个旧词合并成同一表示而覆盖计数。

#### 输入与输出示例

- **输入/调用**：corpus=`['low','low','lower']`、`num_merges=2`；输出例如 merges `[('l','o'),('lo','w')]` 及合并后的 vocabulary。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 43. TorchLeet Grouped Query Attention

**Problem.** Implement GQA with more query heads than key/value heads.

**中文题意。** 用完整 Q heads 和较少 KV heads 实现注意力，并让每组 query heads 共享一份 K/V。

### Reviewed Solution

#### 数学、公式与算法思路

$$
H_q=gH_{kv},\qquad K'_{h}=K_{\lfloor h/g\rfloor}
$$

- **公式 / 不变量。** 每 g 个 query head 共享一个 KV head，减少缓存大小到 MHA 的约 1/g。
- **算法拆解。** 投影并拆 head，按组把 K/V 映射到 query heads，应用 mask/Softmax 后合并；先验证整除关系。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class TorchLeetGQA(nn.Module):
    def __init__(self, d_model, q_heads, kv_heads):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if d_model % q_heads or q_heads % kv_heads:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("head 数不兼容")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.hq, self.hkv, self.dh = q_heads, kv_heads, d_model // q_heads
        # [变化示例] self.hq, self.hkv, self.dh=未定义/旧值 -> self.hq, self.hkv, self.dh=tuple (q_heads, kv_heads, d_model // q_heads)；多个值按位置传递/解包，元素本身不被复制。
        self.q = nn.Linear(d_model, d_model, bias=False)
        # [变化示例] self.q=未定义/旧值 -> self.q=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.k = nn.Linear(d_model, kv_heads*self.dh, bias=False)
        # [变化示例] self.k=未定义/旧值 -> self.k=线性映射模块；输入最后一维 d_model -> 输出最后一维 kv_heads*self.dh。
        self.v = nn.Linear(d_model, kv_heads*self.dh, bias=False)
        # [变化示例] self.v=未定义/旧值 -> self.v=线性映射模块；输入最后一维 d_model -> 输出最后一维 kv_heads*self.dh。
        self.o = nn.Linear(d_model, d_model, bias=False)
        # [变化示例] self.o=未定义/旧值 -> self.o=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。

    def forward(self, x):
        b, s, _ = x.shape
        # [变化示例] b, s, _=未定义/旧值 -> b, s, _=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        q = self.q(x).view(b,s,self.hq,self.dh).transpose(1,2)
        # [变化示例] q=未定义/旧值 -> q=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        k = self.k(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        # [变化示例] k=未定义/旧值 -> k=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        v = self.v(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        # [变化示例] v=未定义/旧值 -> v=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        # KV head 按组复制到 Q head 数量
        repeat = self.hq // self.hkv
        # [变化示例] repeat=未定义/旧值 -> repeat=self.hq // self.hkv；数值示例：7 // 3 -> 2。
        k, v = k.repeat_interleave(repeat,1), v.repeat_interleave(repeat,1)
        # [变化示例] k, v=未定义/旧值 -> k, v=沿指定轴重复；例如 head 轴 H=2、repeats=3 -> H=6。
        y = torch.softmax(q @ k.transpose(-2,-1) / math.sqrt(self.dh), -1) @ v
        # [变化示例] y=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 y；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        return self.o(y.transpose(1,2).contiguous().view(b,s,-1))
        # [变化示例] 函数内部：执行 self.o(y.transpose(1,2).contiguous().view(b,s,-1)) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库答案每次函数调用都新建随机 Linear，而且 K/V reshape 维度错误；修正版把投影注册为持久参数，并统一每个 head 的宽度为 `Dh`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.repeat_interleave(...)`：`.repeat_interleave(r, dim)` 真正复制元素；GQA 用它把每个 KV head 对应到多个 Q heads。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。

#### 输入与输出示例

- **输入/调用**：输入 `(B=2,S=8,D=64)`、8 个 Q heads、2 个 KV heads；KV 各复制 4 次与 Q 对齐，输出 `(2,8,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 44. TorchLeet Attention from Scratch

**Problem.** Implement masked scaled dot-product attention and return both output and weights.

**中文题意。** 从矩阵乘法实现 attention，支持可广播 mask，并同时返回上下文向量和注意力概率。

### Reviewed Solution

#### 数学、公式与算法思路

$$
S=\frac{QK^\top}{\sqrt d},\qquad P=\operatorname{softmax}(S),\qquad O=PV
$$

- **公式 / 不变量。** 从零实现 attention 时最关键的是明确 score 的最后两维分别是 query 长度与 key 长度。
- **算法拆解。** 做 shape 检查、缩放点积、可选 mask、稳定 Softmax、value 加权；每一步记录 shape 可避免轴错误。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def attention_with_weights(q, k, v, mask=None):
    # 使用 Python 标量缩放，避免创建 CPU tensor 导致 GPU device mismatch
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.size(-1))
    # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    if mask is not None:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        scores = scores.masked_fill(~mask.to(torch.bool), float("-inf"))
        # [变化示例] scores=未定义/旧值 -> scores 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    weights = torch.softmax(scores, dim=-1)
    # [变化示例] weights=未定义/旧值 -> weights=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    return weights @ v, weights
    # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。
```

**中文解释。** 原逻辑基本正确，但 `torch.tensor(d_k)` 默认在 CPU；GPU 输入时可能报 device mismatch。使用 `math.sqrt` 最简单安全。

#### 代码/API 逐项解释

- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：`q:(1,3,4), k/v:(1,5,4)`、mask `(1,3,5)`；返回 output `(1,3,4)` 与 attention weights `(1,3,5)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 45. TorchLeet Multi-Head Attention

**Problem.** Implement trainable multi-head self-attention.

**中文题意。** 将 Q/K/V 拆头计算注意力，再拼接输出；投影参数必须被模型持久保存和训练。

### Reviewed Solution

#### 数学、公式与算法思路

$$
head_h=\operatorname{Attention}(XW_h^Q,XW_h^K,XW_h^V),\qquad O=[head_1;\ldots;head_H]W^O
$$

- **公式 / 不变量。** 多头结构让不同 head 学习不同关系，但总模型维通常保持不变。
- **算法拆解。** 一次投影后 reshape/transpose 批量计算所有 head，再 concat 和输出投影；要求 d_model 可被 H 整除。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class TorchLeetMHA(MultiHeadAttention):
    def forward(self, x, mask=None):
        # 复用第 06 题的持久 nn.Module 参数，而不是在 forward 内新建 Linear
        q, k, v = self._split(self.W_q(x)), self._split(self.W_k(x)), self._split(self.W_v(x))
        # [变化示例] q, k, v=未定义/旧值 -> q, k, v 接收 self._split(self.W_q(x)), self._split(self.W_k(x)), self._s... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        scores = q @ k.transpose(-2,-1) / math.sqrt(self.d_head)
        # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        if mask is not None:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            scores = scores.masked_fill(~mask.to(torch.bool), float("-inf"))
            # [变化示例] scores=未定义/旧值 -> scores 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        ctx = torch.softmax(scores, -1) @ v
        # [变化示例] ctx=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 ctx；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        b, _, s, _ = ctx.shape
        # [变化示例] b, _, s, _=未定义/旧值 -> b, _, s, _=ctx.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        return self.W_o(ctx.transpose(1,2).contiguous().view(b,s,-1))
        # [变化示例] 函数内部：执行 self.W_o(ctx.transpose(1,2).contiguous().view(b,s,-1)) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库函数还依赖未定义的 `device`，并在每次 forward 随机重建四个 Linear，导致参数无法学习。这里改为标准 `nn.Module` 语义。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：输入 `(2,6,32)`、4 heads；每头维度 8，mask 广播到 `(2,4,6,6)`，合并后输出 `(2,6,32)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 46. TorchLeet RoPE

**Problem.** Cache rotary sine/cosine values and rotate Q/K features.

**中文题意。** 预计算位置旋转所需的 cos/sin，并应用到 query/key 的成对特征。

### Reviewed Solution

#### 数学、公式与算法思路

$$
q'_m=R(m\theta)q_m,\qquad k'_n=R(n\theta)k_n,\qquad q_m'^\top k_n'=q_m^\top R((n-m)\theta)k_n
$$

- **公式 / 不变量。** RoPE 的关键性质是旋转后的内积只依赖位置差 n-m，因此把相对位置编码进 attention score。
- **算法拆解。** 预计算 cos/sin cache，按序列位置切片并广播到 batch/head，成对旋转 Q/K；检查缓存长度和 dtype。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class RotaryEmbedding(nn.Module):
    def __init__(self, dim, base=10000.0):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if dim % 2:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            raise ValueError("RoPE 维度必须为偶数")
            # [变化示例] 控制流：正常执行路径 -> 抛出异常并停止当前函数，用于拒绝非法输入。
        self.register_buffer("inv_freq", base ** (-torch.arange(0,dim,2).float()/dim))
        # [变化示例] 执行状态：调用 self.register_buffer("inv_freq", base ** (-torch.arange(0,d... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    def forward(self, x, offset=0):
        # x: (B,H,S,D)，offset 支持 KV-cache 解码
        pos = torch.arange(offset, offset+x.size(-2), device=x.device, dtype=self.inv_freq.dtype)
        # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(offset, offset+x.size(-2)；例如 arange(4) 为 [0,1,2,3]。
        angle = torch.outer(pos, self.inv_freq)
        # [变化示例] angle=未定义/旧值 -> angle=外积；shape (M,) 与 (N,) -> (M,N)。
        angle = torch.cat((angle, angle), -1).to(x.dtype)[None,None]
        # [变化示例] angle=未定义/旧值 -> angle 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。
        half = torch.cat((-x[..., x.size(-1)//2:], x[..., :x.size(-1)//2]), -1)
        # [变化示例] half=未定义/旧值 -> half 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。
        return x*angle.cos() + half*angle.sin()
        # [变化示例] 函数内部：x*angle.cos() + half*angle.sin()；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** 原实现的缓存布局依赖特定输入维度，且没有 offset。修正版明确使用 `(B,H,S,D)`，适合训练和增量解码。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.outer`：两个一维向量的外积：`(M)` 与 `(N)` 得到 `(M,N)`，位置和频率组合时很方便。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `.register_buffer(...)`：`.register_buffer(name,tensor)` 注册不训练但需随模型迁移/保存的状态，如位置编码或 running stats。
- `.float(...)`：`.float()` 转为 float32；混合精度中常对统计量临时升精度。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。

#### 输入与输出示例

- **输入/调用**：位置长度 4、head dim 8 时，频率表 shape `(4,4)`；cos/sin 扩成 `(4,8)` 后逐位置旋转 q/k，shape 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 47. Sinusoidal Positional Embedding

**Problem.** Build fixed sine/cosine position vectors for Transformer inputs.

**中文题意。** 为每个位置生成固定的正弦/余弦向量，不参与训练，并按序列长度切片返回。

### Reviewed Solution

#### 数学、公式与算法思路

$$
PE_{pos,2i}=\sin\!\left(pos/10000^{2i/d}\right),\qquad PE_{pos,2i+1}=\cos\!\left(pos/10000^{2i/d}\right)
$$

- **公式 / 不变量。** 不同频率的正弦余弦为每个位置产生确定性向量，也允许模型线性表达相对位移。
- **算法拆解。** 构造位置列向量和频率行向量，外积得角度，偶数维填 sin、奇数维填 cos；无需训练参数。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class SinusoidalPosition(nn.Module):
    def __init__(self, max_len, d_model):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        pe = torch.zeros(max_len, d_model)
        # [变化示例] pe=未定义/旧值 -> pe=全 0 张量；shape 由 max_len, d_model 指定。
        pos = torch.arange(max_len).float()[:,None]
        # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(max_len)；例如 arange(4) 为 [0,1,2,3]。
        freq = torch.exp(torch.arange(0,d_model,2).float()*(-math.log(10000.0)/d_model))
        # [变化示例] freq=未定义/旧值 -> freq=逐元素指数；例如 [0,1] -> [1,2.718]。
        pe[:,0::2] = torch.sin(pos*freq)
        # [变化示例] 目标切片 pe[:,0::2]=旧值 -> torch.sin(pos*freq)；base tensor 对应位置同步被写入。
        # odd d_model 时，cos 列比 sin 少一列
        pe[:,1::2] = torch.cos(pos*freq[:pe[:,1::2].shape[1]])
        # [变化示例] 目标切片 pe[:,1::2]=旧值 -> torch.cos(pos*freq[:pe[:,1::2].shape[1]])；base tensor 对应位置同步被写入。
        self.register_buffer("pe", pe[None])
        # [变化示例] 执行状态：调用 self.register_buffer("pe", pe[None]) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    def forward(self, x):
        return x + self.pe[:,:x.size(1)].to(x.dtype)
        # [变化示例] 函数内部：x + self.pe[:,:x.size(1)].to(x.dtype)；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** 仓库答案对偶数 `d_model` 正确；这里额外兼容奇数维，并直接返回“输入加位置编码”的常见模块行为。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.sin`：逐元素正弦，位置编码中与 cos 配对，为不同频率提供相位信息。
- `torch.cos`：逐元素余弦，位置编码中与 sin 配对，使相对位移可由旋转关系表达。
- `.float(...)`：`.float()` 转为 float32；混合精度中常对统计量临时升精度。
- `.register_buffer(...)`：`.register_buffer(name,tensor)` 注册不训练但需随模型迁移/保存的状态，如位置编码或 running stats。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。
- `math.log(x)`：对正的 Python 标量求自然对数并返回 `float`；位置编码中 `-log(10000)/D` 是固定频率尺度，不需要梯度。若输入是 tensor 或需参与 autograd，应使用 tensor `.log()`。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。
- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。

#### 输入与输出示例

- **输入/调用**：`max_len=4,d_model=6` 产生位置表 `(4,6)`；位置 0 的 sin 通道为 0、cos 通道为 1，输入 batch 加上对应行后 shape 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 48. SmolLM from Scratch

**Problem.** Assemble embeddings, RMSNorm, RoPE-GQA, SwiGLU blocks, causal masking, and a tied LM head.

**中文题意。** 将前面组件组装为小型 decoder-only language model，并输出每个 token 的 vocabulary logits。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p(x_{t+1}|x_{\le t})=\operatorname{softmax}(W_{lm}\,\operatorname{LN}(h_t))
$$

- **公式 / 不变量。** 小型语言模型由 token/位置表示、重复 Transformer block、最终归一化和词表投影组成。
- **算法拆解。** 嵌入并加位置，逐层执行 causal block，最终映射到 vocab logits；训练目标把输入与下一 token 标签错开一位。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def rope_heads(x, offset=0):
    # x:(B,H,S,Dh)，相邻偶/奇维组成二维旋转对
    d = x.size(-1)
    # [变化示例] d=未定义/旧值 -> d=指定轴长度；例如 shape=(2,3,4)，size(-1) -> 对应维长度。
    if d % 2: raise ValueError("RoPE head_dim 必须为偶数")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    pos = torch.arange(offset, offset+x.size(-2), device=x.device, dtype=torch.float32)
    # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(offset, offset+x.size(-2)；例如 arange(4) 为 [0,1,2,3]。
    inv = 10000.0 ** (-torch.arange(0,d,2,device=x.device,dtype=torch.float32)/d)
    # [变化示例] inv=未定义/旧值 -> inv=10000.0 ** (-torch.arange(0,d,2,device=x.device,dtype=torch.flo...；数值示例：2 ** 3 -> 8。
    angle = torch.outer(pos, inv).to(x.dtype)[None,None]
    # [变化示例] angle=未定义/旧值 -> angle 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    even, odd = x[...,0::2], x[...,1::2]
    # [变化示例] even, odd=未定义/旧值 -> even, odd=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
    return torch.stack((even*angle.cos()-odd*angle.sin(),
                        even*angle.sin()+odd*angle.cos()),-1).flatten(-2)
    # [变化示例] 函数内部：result 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0） -> 调用方收到该输出。

class SmolAttention(nn.Module):
    def __init__(self, d_model, q_heads, kv_heads):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if d_model % q_heads or q_heads % kv_heads: raise ValueError("head 配置无效")
        # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
        self.hq, self.hkv, self.dh = q_heads, kv_heads, d_model//q_heads
        # [变化示例] self.hq, self.hkv, self.dh=未定义/旧值 -> self.hq, self.hkv, self.dh=tuple (q_heads, kv_heads, d_model//q_heads)；多个值按位置传递/解包，元素本身不被复制。
        self.q = nn.Linear(d_model,d_model,bias=False)
        # [变化示例] self.q=未定义/旧值 -> self.q=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
        self.k = nn.Linear(d_model,kv_heads*self.dh,bias=False)
        # [变化示例] self.k=未定义/旧值 -> self.k=线性映射模块；输入最后一维 d_model -> 输出最后一维 kv_heads*self.dh。
        self.v = nn.Linear(d_model,kv_heads*self.dh,bias=False)
        # [变化示例] self.v=未定义/旧值 -> self.v=线性映射模块；输入最后一维 d_model -> 输出最后一维 kv_heads*self.dh。
        self.o = nn.Linear(d_model,d_model,bias=False)
        # [变化示例] self.o=未定义/旧值 -> self.o=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_model。
    def forward(self,x):
        b,s,_=x.shape
        # [变化示例] b,s,_=未定义/旧值 -> b,s,_=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
        q=self.q(x).view(b,s,self.hq,self.dh).transpose(1,2)
        # [变化示例] q=未定义/旧值 -> q=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        k=self.k(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        # [变化示例] k=未定义/旧值 -> k=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        v=self.v(x).view(b,s,self.hkv,self.dh).transpose(1,2)
        # [变化示例] v=未定义/旧值 -> v=先拆分 shape 再交换轴；例如 (B,S,H*D) -> (B,S,H,D) -> (B,H,S,D)。
        q,k=rope_heads(q),rope_heads(k)
        # [变化示例] q,k=未定义/旧值 -> q,k 接收 rope_heads(q),rope_heads(k) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        repeat=self.hq//self.hkv
        # [变化示例] repeat=未定义/旧值 -> repeat=self.hq//self.hkv；数值示例：7 // 3 -> 2。
        k,v=k.repeat_interleave(repeat,1),v.repeat_interleave(repeat,1)
        # [变化示例] k,v=未定义/旧值 -> k,v=沿指定轴重复；例如 head 轴 H=2、repeats=3 -> H=6。
        scores=q@k.transpose(-2,-1)/math.sqrt(self.dh)
        # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        future=torch.triu(torch.ones(s,s,device=x.device,dtype=torch.bool),1)
        # [变化示例] future=未定义/旧值 -> future=上三角部分；例如 3x3 全 1 且 diagonal=1 -> 仅严格上三角为 1。
        y=torch.softmax(scores.masked_fill(future,-torch.inf),-1)@v
        # [变化示例] y=未定义/旧值 -> 先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 y；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D)。
        return self.o(y.transpose(1,2).contiguous().view(b,s,-1))
        # [变化示例] 函数内部：执行 self.o(y.transpose(1,2).contiguous().view(b,s,-1)) 得到结果 -> 调用方收到该输出。

class SmolBlock(nn.Module):
    def __init__(self,d_model,q_heads,kv_heads,d_ff):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.n1,self.n2=nn.RMSNorm(d_model),nn.RMSNorm(d_model)
        # [变化示例] self.n1,self.n2=未定义/旧值 -> self.n1,self.n2 接收 nn.RMSNorm(d_model),nn.RMSNorm(d_model) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.attn=SmolAttention(d_model,q_heads,kv_heads)
        # [变化示例] self.attn=未定义/旧值 -> self.attn 接收 SmolAttention(d_model,q_heads,kv_heads) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.gate,self.up=nn.Linear(d_model,d_ff,bias=False),nn.Linear(d_model,d_ff,bias=False)
        # [变化示例] self.gate,self.up=未定义/旧值 -> self.gate,self.up=线性映射模块；输入最后一维 d_model -> 输出最后一维 d_ff。
        self.down=nn.Linear(d_ff,d_model,bias=False)
        # [变化示例] self.down=未定义/旧值 -> self.down=线性映射模块；输入最后一维 d_ff -> 输出最后一维 d_model。
    def forward(self,x):
        # Pre-Norm residual：先 attention，再 SwiGLU
        x=x+self.attn(self.n1(x))
        # [变化示例] x=未定义/旧值 -> x=x+self.attn(self.n1(x))；数值示例：2 + 3 -> 5。
        z=self.n2(x)
        # [变化示例] z=未定义/旧值 -> z 接收 self.n2(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return x+self.down(F.silu(self.gate(z))*self.up(z))
        # [变化示例] 函数内部：x+self.down(F.silu(self.gate(z))*self.up(z))；数值示例：2 + 3 -> 5 -> 调用方收到该输出。

class SmolLM(nn.Module):
    def __init__(self, vocab, d_model, layers, q_heads, kv_heads, d_ff):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.embed = nn.Embedding(vocab, d_model)
        # [变化示例] self.embed=未定义/旧值 -> self.embed=Embedding 查表模块；token ids shape (B,S) -> 输出 (B,S,D)。
        self.blocks = nn.ModuleList([SmolBlock(d_model,q_heads,kv_heads,d_ff)
                                     for _ in range(layers)])
        # [变化示例] self.blocks=未定义/旧值 -> self.blocks=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        self.norm = nn.RMSNorm(d_model)
        # [变化示例] self.norm=未定义/旧值 -> self.norm 接收 nn.RMSNorm(d_model) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.lm_head = nn.Linear(d_model, vocab, bias=False)
        # [变化示例] self.lm_head=未定义/旧值 -> self.lm_head=线性映射模块；输入最后一维 d_model -> 输出最后一维 vocab。
        self.lm_head.weight = self.embed.weight
        # [变化示例] self.lm_head.weight=未定义/旧值 -> self.lm_head.weight=self.embed.weight；这是一次重新绑定/状态更新，右侧值决定新状态。

    def forward(self, ids):
        x = self.embed(ids)
        # [变化示例] x=未定义/旧值 -> x 接收 self.embed(ids) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        for block in self.blocks: x=block(x)
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        return self.lm_head(self.norm(x))  # (B,S,V) raw logits
        # [变化示例] 函数内部：执行 self.lm_head(self.norm(x)) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库完整答案存在 device buffer、`attention_mask=None`、外部权重文件和生成输入原地修改等问题，不能独立稳定运行。修正版真正包含 RMSNorm、RoPE、GQA、causal mask、SwiGLU、Pre-Norm residual 和 tied embedding/LM head。面试时要能从 `(B,S,D)` 一直追踪到 attention 的 `(B,H,S,Dh)`，并解释为什么 KV heads 少于 Q heads 能降低 cache 内存。

#### 代码/API 逐项解释

- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `torch.outer`：两个一维向量的外积：`(M)` 与 `(N)` 得到 `(M,N)`，位置和频率组合时很方便。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.triu`：保留矩阵上三角；`diagonal=1` 可标出严格未来位置，用于 causal mask。
- `torch.ones`：创建指定 shape 的全 1 张量，常作为 mask 的原始矩阵或正标签。
- `torch.bool`：布尔 dtype；mask 的 True 到底表示允许还是屏蔽取决于具体 API contract。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `nn.RMSNorm`：按 root-mean-square 缩放而不减均值，常见于现代 LLM。
- `F.silu`：SiLU/Swish：`x*sigmoid(x)`；SwiGLU 用它处理 gate 分支后再与 value 分支逐元素相乘。
- `nn.Embedding`：把整数 token id `(...,)` 查表为 `(...,D)`；本质是权重矩阵的行索引。
- `nn.ModuleList`：注册一组子模块但不定义连接方式；forward 中仍需显式循环或路由。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.repeat_interleave(...)`：`.repeat_interleave(r, dim)` 真正复制元素；GQA 用它把每个 KV head 对应到多个 Q heads。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.contiguous(...)`：`.contiguous()` 按当前逻辑顺序生成连续内存，保证后续 `view` 或某些 kernel 可用。
- `.norm(...)`：`.norm(dim=...)` 计算范数；embedding normalize 前要用 epsilon 防止零向量除 0。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。
- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：token ids `(2,16)` 经过 embedding、多个 block、final norm 和 lm head，输出 logits `(2,16,vocab_size)`；训练 target 通常右移一位。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 49. Custom Activation Module

**Problem.** Use `tanh(x)+x` after a linear layer.

**中文题意。** 实现无参数自定义激活，并嵌入简单回归模型。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{SiLU}(x)=x\sigma(x)
$$

- **公式 / 不变量。** 自定义激活模块只需保持纯 tensor 运算，autograd 会按链式法则自动构建梯度。
- **算法拆解。** 在 forward 中组合可微操作，不手动 detach；用输入输出 shape 和极端值检查实现。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class CustomActivationModel(nn.Module):
    def __init__(self, in_features=1, out_features=1):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.linear = nn.Linear(in_features, out_features)
        # [变化示例] self.linear=未定义/旧值 -> self.linear=线性映射模块；输入最后一维 in_features -> 输出最后一维 out_features。

    def forward(self, x):
        z = self.linear(x)
        # [变化示例] z=未定义/旧值 -> z 接收 self.linear(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return torch.tanh(z) + z  # 平滑非线性 + residual
        # [变化示例] 函数内部：torch.tanh(z) + z；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** 仓库答案正确。该激活没有参数，且所有操作都由 autograd 支持。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.tanh`：把数值压到 `(-1,1)`，且以 0 为中心；RNN 候选状态常用它控制幅度。

- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。

#### 输入与输出示例

- **输入/调用**：输入 `x.shape=(4,10)`；Linear 后逐元素执行自定义 `x*tanh(x)`，第二个 Linear 输出模型设定的 `(4,Dout)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 50. Custom Dataset and DataLoader

**Problem.** Read feature/target columns from CSV and expose Dataset indexing.

**中文题意。** 从 CSV 读取 X/y，正确实现 `__len__`、`__getitem__`，再交给 DataLoader 批处理。

### Reviewed Solution

#### 数学、公式与算法思路

$$
N_{batches}=\left\lceil\frac{N}{B}\right\rceil\quad\text{unless drop\_last=True}
$$

- **公式 / 不变量。** Dataset 定义单样本索引语义，DataLoader 负责采样、批处理、shuffle 和多进程加载。
- **算法拆解。** 实现 __len__ 与 __getitem__，再由 collate_fn 把样本堆成 batch；检查最后一批和随机性。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class CSVDataset(torch.utils.data.Dataset):
    def __init__(self, csv_file):
        frame = pd.read_csv(csv_file)
        # [变化示例] frame=未定义/旧值 -> frame 接收 pd.read_csv(csv_file) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        # 预先转 tensor，避免每次 __getitem__ 重复转换
        self.x = torch.as_tensor(frame[["X"]].to_numpy(), dtype=torch.float32)
        # [变化示例] self.x=未定义/旧值 -> self.x 接收 torch.as_tensor(frame[["X"]].to_numpy(), dtype=torch.float32) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.y = torch.as_tensor(frame[["y"]].to_numpy(), dtype=torch.float32)
        # [变化示例] self.y=未定义/旧值 -> self.y 接收 torch.as_tensor(frame[["y"]].to_numpy(), dtype=torch.float32) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    def __len__(self): return self.x.size(0)
    # [变化示例] 调用该单行函数时：函数内部：指定轴长度；例如 shape=(2,3,4)，size(0) -> 对应维长度 -> 调用方收到该输出。
    def __getitem__(self, index): return self.x[index], self.y[index]
    # [变化示例] 调用该单行函数时：函数内部：索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,) -> 调用方收到该输出。

loader = DataLoader(CSVDataset("data.csv"), batch_size=32, shuffle=True)
# [变化示例] loader=未定义/旧值 -> loader=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。
```

**中文解释。** 仓库实现正确，但类名与题目要求不一致。核心 contract 是长度和单样本索引；DataLoader 再负责 shuffle、batch 和 worker。

#### 代码/API 逐项解释

- `torch.utils.data.Dataset`：数据集协议：实现 `__len__` 和 `__getitem__` 后，DataLoader 才能索引、打乱和批处理样本。
- `torch.as_tensor`：尽量复用 NumPy/已有数据的存储而不是无条件复制；转换数据集样本时要显式控制 dtype。
- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。

#### 输入与输出示例

- **输入/调用**：CSV 一行含 5 个 feature 和 1 个 label；`dataset[0]` 输出 float32 feature `(5,)` 与 label，DataLoader batch 后成为 `(B,5)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 51. Custom DNN

**Problem.** Build a nonlinear regression network with a hidden layer and scalar output.

**中文题意。** 输入经过 Linear、ReLU、Linear，输出一个回归值。

### Reviewed Solution

#### 数学、公式与算法思路

$$
h^{(l)}=\phi(W^{(l)}h^{(l-1)}+b^{(l)}),\qquad \hat y=W^{(L)}h^{(L-1)}+b^{(L)}
$$

- **公式 / 不变量。** DNN 交替执行仿射变换和非线性；最后一层是否激活取决于损失是否期待 logits。
- **算法拆解。** 按层注册 Module，forward 顺序连接，训练时 loss.backward 后 optimizer.step；避免在 forward 动态创建参数。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class DNNModel(nn.Module):
    def __init__(self, in_features=2, hidden=32):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden), nn.ReLU(), nn.Linear(hidden, 1)
        )
        # [变化示例] self.net=未定义/旧值 -> self.net=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
    def forward(self, x):
        # 两层线性映射之间加入 ReLU，才能拟合非线性关系
        return self.net(x)  # (B,2) -> (B,H) -> (B,1)
        # [变化示例] 函数内部：执行 self.net(x) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库模型正确。回归末层不加 Softmax/Sigmoid，才能输出任意实数。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。

#### 输入与输出示例

- **输入/调用**：输入 `(32,20)`，Sequential 依次变成 `(32,64)->(32,32)->(32,num_classes)`；输出是 raw logits。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 52. Huber Loss

**Problem.** Implement a loss that is quadratic for small errors and linear for outliers.

**中文题意。** 当绝对误差不超过 delta 时用平方损失，否则切换为线性增长，降低离群点影响。

### Reviewed Solution

#### 数学、公式与算法思路

$$
L_\delta(e)=\begin{cases}\frac12e^2&|e|\le\delta\\\delta(|e|-\frac12\delta)&|e|>\delta\end{cases}
$$

- **公式 / 不变量。** Huber Loss 在小误差区像 MSE 平滑，在大误差区像 MAE 线性增长，因此对离群点更鲁棒。
- **算法拆解。** 计算绝对误差，按 delta 分段选择二次项或线性项，再按 reduction 聚合。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class HuberLoss(nn.Module):
    def __init__(self, delta=1.0):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        if delta <= 0: raise ValueError("delta 必须为正")
        # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
        self.delta = delta
        # [变化示例] self.delta=未定义/旧值 -> self.delta=delta；这是一次重新绑定/状态更新，右侧值决定新状态。
    def forward(self, pred, target):
        e = (pred-target).abs()
        # [变化示例] e=未定义/旧值 -> e 接收 (pred-target).abs() 的返回值；用 shape/dtype/device 与示例输入核对变化。
        # 两段在 e=delta 处函数值和一阶导数都连续
        return torch.where(e <= self.delta, 0.5*e.square(),
                           self.delta*(e-0.5*self.delta)).mean()
        # [变化示例] 函数内部：按条件逐元素选择；例如 x=[-2,0,3]、条件 x>0 -> [0,0,3] -> 调用方收到该输出。
```

**中文解释。** 仓库公式正确；修正版增加 delta 校验。Huber 在小误差处保留 MSE 的平滑性，在大误差处像 L1 一样稳健。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `torch.where`：逐元素条件选择：`torch.where(condition, a, b)` 在条件为 True 的位置取 `a`，否则取 `b`；三者需满足 broadcasting 规则。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：误差 `[0.5,2.0]`、delta=1：前者 loss=`0.5*0.5^2=0.125`，后者 loss=`1*(2-0.5)=1.5`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 53. Linear Regression Module

**Problem.** Define a trainable linear regression model in PyTorch.

**中文题意。** 用单个 Linear 将输入特征映射为连续预测值，并通过 MSE 与优化器训练。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\hat y=xw+b,\qquad \nabla_w\mathcal{L}=\frac{2}{N}X^\top(Xw+b-y)
$$

- **公式 / 不变量。** nn.Module 版本把参数注册、状态保存和设备迁移统一起来，数学目标仍是标准线性回归。
- **算法拆解。** 在 __init__ 定义层，在 forward 调用；训练循环固定为清梯度、前向、loss、反向、更新。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class LinearRegressionModel(nn.Module):
    def __init__(self, input_dim=1):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.linear = nn.Linear(input_dim, 1)
        # [变化示例] self.linear=未定义/旧值 -> self.linear=线性映射模块；输入最后一维 input_dim -> 输出最后一维 1。
    def forward(self, x):
        # Linear 内部完成矩阵乘法与 bias 广播
        return self.linear(x)  # y_hat = XW^T + b
        # [变化示例] 函数内部：执行 self.linear(x) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库答案正确。标准循环顺序是 `zero_grad -> forward -> loss -> backward -> step`。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。

- `self.linear = ...`：赋给 Module 属性后，weight/bias 才会注册到 state_dict 和 optimizer。
- `self.linear(x)`：会触发该子模块的 `__call__`，进而执行 forward 和 hooks；不要手动调用 `self.linear.forward(x)`。

#### 输入与输出示例

- **输入/调用**：输入 `X.shape=(16,3)`，`nn.Linear(3,1)` 输出预测 `(16,1)`；与同 shape target 计算回归 loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 54. Save and Load a Model

**Problem.** Save model weights and restore them into a new instance safely.

**中文题意。** 使用 `state_dict` 保存参数，并在相同架构实例中加载，用于推理或继续训练。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\text{checkpoint}=\{\theta,\ state_{opt},\ epoch,\ rng\_state\}
$$

- **公式 / 不变量。** 可恢复训练不仅需要模型参数，还需要优化器动量、训练进度和必要的随机状态。
- **算法拆解。** 保存 state_dict 而非整个对象；加载时先构造相同结构，再 load_state_dict，并显式设置 map_location。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
# 保存参数，不序列化整个 Python 对象
torch.save(model.state_dict(), "model.pth")
# [变化示例] 执行状态：调用 torch.save(model.state_dict(), "model.pth") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
loaded = SimpleModel()
# [变化示例] loaded=未定义/旧值 -> loaded=SimpleModel()；这是一次重新绑定/状态更新，右侧值决定新状态。
state = torch.load("model.pth", map_location="cpu", weights_only=True)
# [变化示例] state=未定义/旧值 -> state 接收 torch.load("model.pth", map_location="cpu", weights_only=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
loaded.load_state_dict(state)
# [变化示例] 执行状态：调用 loaded.load_state_dict(state) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
loaded.eval()  # 关闭 Dropout，并让 BatchNorm 使用 running stats
# [变化示例] 模块模式：旧 train/eval 标志 -> 评估模式，影响 Dropout/BatchNorm。
```

**中文解释。** 仓库主流程正确。修正版增加 `map_location` 和 `weights_only=True`，更安全且能从 GPU checkpoint 加载到 CPU。

#### 代码/API 逐项解释

- `torch.save`：用 PyTorch 序列化对象；推荐保存 `state_dict` 和必要元数据，而不是依赖整个 Python 模型对象。
- `torch.load`：反序列化 checkpoint；加载不可信文件存在代码执行风险，且应使用 `map_location` 处理设备差异。
- `.state_dict(...)`：`.state_dict()` 返回参数和持久 buffer 的名称到张量映射，是推荐 checkpoint 边界。
- `.load_state_dict(...)`：`.load_state_dict(...)` 按名称恢复参数/buffer；`strict=True` 会报告缺失或多余键。

- `.eval(...)`：`.eval()` 等价于 `train(False)`；它不自动关闭梯度，推理仍应配合 inference_mode/no_grad。

#### 输入与输出示例

- **输入/调用**：保存 `model.state_dict()` 后得到参数名到 tensor 的映射；新建同结构模型并 load 后，相同输入应产生相同输出。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 55. TensorBoard Logging

**Problem.** Log training loss for every epoch and visualize it in TensorBoard.

**中文题意。** 创建 SummaryWriter，在训练过程中记录标量指标，结束后正确关闭 writer。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\text{event}_t=(\text{tag},\text{value}_t,\text{global\_step}=t)
$$

- **公式 / 不变量。** TensorBoard 通过统一 global step 对齐 loss、学习率、梯度分布等时间序列。
- **算法拆解。** 创建 writer，训练中按固定频率记录 scalar/histogram/image，结束时 flush/close；tag 命名要稳定。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
from torch.utils.tensorboard import SummaryWriter

with SummaryWriter("runs/linear_regression") as writer:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    for epoch in range(epochs):
        # [变化示例] 循环示例：range(epochs) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        optimizer.zero_grad()
        # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
        loss = criterion(model(X), y)
        # [变化示例] loss=未定义/旧值 -> loss 接收 criterion(model(X), y) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        loss.backward(); optimizer.step()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
        writer.add_scalar("loss/train", loss.item(), epoch)
        # [变化示例] 执行状态：调用 writer.add_scalar("loss/train", loss.item(), epoch) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        # flush/close 由 with 自动处理，日志不会丢失
```

**中文解释。** 仓库答案正确。Step 应使用 epoch 或全局 batch step，tag 应保持稳定，才能形成连续曲线。

#### 代码/API 逐项解释

- `torch.utils.tensorboard.SummaryWriter`：把 scalar、histogram、image 等 summary 异步写入 event 文件；`with` 退出时会 flush/close。`log_dir` 决定 run 目录，重复实验应使用可区分目录以免曲线混杂。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。
- `.add_scalar(...)`：签名核心是 `add_scalar(tag, scalar_value, global_step)`；tag 决定曲线名称，global_step 决定横轴。这里输入 loss 标量和 epoch，不返回训练张量，而是向 event 日志追加一条记录。

#### 输入与输出示例

- **输入/调用**：训练第 7 step 调用 `add_scalar('train/loss',0.42,7)`；TensorBoard 读取 event 文件后显示 loss 曲线上的 `(7,0.42)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 56. Image Augmentation

**Problem.** Apply random horizontal flip, random crop, tensor conversion, and normalization.

**中文题意。** 训练集使用随机增强；测试集只做确定性预处理，保证评估可重复。

### Reviewed Solution

#### 数学、公式与算法思路

$$
(x',y')=T_\omega(x,y),\qquad \omega\sim p(\omega)
$$

- **公式 / 不变量。** 数据增强从随机变换分布采样，同时必须保持标签语义；几何任务还要同步变换 mask 或框。
- **算法拆解。** 训练集应用随机增强，验证集只做确定性预处理；先转 tensor 还是先几何变换取决于算子接口。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
train_tf = transforms.Compose([
    transforms.RandomHorizontalFlip(0.5),
    transforms.RandomCrop(32, padding=4),
    transforms.ToTensor(),
    transforms.Normalize((0.4914,0.4822,0.4465),(0.2470,0.2435,0.2616)),
])
# [变化示例] train_tf=未定义/旧值 -> train_tf 接收 transforms.Compose([ transforms.RandomHorizontalFlip(0.5), ... 的返回值；用 shape/dtype/device 与示例输入核对变化。
test_tf = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.4914,0.4822,0.4465),(0.2470,0.2435,0.2616)),
])  # 测试集不能使用随机 crop/flip
# [变化示例] test_tf=未定义/旧值 -> test_tf 接收 transforms.Compose([ transforms.ToTensor(), transforms.Norm... 的返回值；用 shape/dtype/device 与示例输入核对变化。
```

**中文解释。** 仓库答案把随机训练增强也用于 test set，评估会随机波动；题面还写 28x28 而代码使用 CIFAR 常见的 padded 32x32 crop。修正版按 CIFAR-10 语义统一。

#### 代码/API 逐项解释



- `transforms.Compose([...])`：按列表顺序把前一个 transform 的输出传给下一个；随机空间增强应在 `ToTensor/Normalize` 前后按 API 输入类型要求放置，输出是最终处理后的单张图像而不是一个 batch。
- `transforms.RandomHorizontalFlip(p=0.5)`：每次调用独立采样，概率 p 水平翻转图像；shape 不变。若类别或坐标标签依赖左右方向，图像与标签必须同步变换或禁用该增强。
- `transforms.RandomCrop(32, padding=4)`：先四周补 4 像素，把 32x32 临时变为 40x40，再随机裁回 32x32；输出 shape 不变，但相当于引入最多 4 像素的平移扰动。
- `transforms.ToTensor()`：把 PIL/HWC uint8 图像转为 CHW float tensor，并把 `[0,255]` 缩放到 `[0,1]`；若输入本来就是特殊范围 tensor，不能假设会执行同样缩放。
- `transforms.Normalize(mean,std)`：逐 channel 执行 `(x[c]-mean[c])/std[c]`，shape 不变；mean/std 长度必须等于 channel 数，反可视化时要执行逆变换。

#### 输入与输出示例

- **输入/调用**：输入 PIL/RGB 图像 `(H,W,3)`；随机翻转/裁剪后 `ToTensor` 输出 `(3,H,W)` float，并按 channel mean/std 标准化。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 57. Autoencoder Anomaly Detection

**Problem.** Reconstruct MNIST images and use reconstruction error as anomaly score.

**中文题意。** 编码器压缩图像，解码器恢复到 28x28；训练后用每个样本的重建误差检测异常。

### Reviewed Solution

#### 数学、公式与算法思路

$$
s(x)=\lVert x-f_\theta(x)\rVert_2^2,\qquad \text{anomaly if }s(x)>\tau
$$

- **公式 / 不变量。** 自编码器在正常数据上学习重建，异常样本通常产生更大重建误差。
- **算法拆解。** 只用正常样本训练，验证集估计阈值 tau，推理计算逐样本误差；阈值需依据业务代价选择。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class Autoencoder(nn.Module):
    def __init__(self):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.encoder = nn.Sequential(nn.Conv2d(1,32,3,padding=1), nn.ReLU(),
                                     nn.MaxPool2d(2), nn.Conv2d(32,64,3,padding=1),
                                     nn.ReLU(), nn.MaxPool2d(2))
        # [变化示例] self.encoder=未定义/旧值 -> self.encoder=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        self.decoder = nn.Sequential(nn.ConvTranspose2d(64,32,4,2,1), nn.ReLU(),
                                     nn.ConvTranspose2d(32,1,4,2,1), nn.Sigmoid())
        # [变化示例] self.decoder=未定义/旧值 -> self.decoder=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
    def forward(self, x): return self.decoder(self.encoder(x))
    # [变化示例] 调用该单行函数时：函数内部：执行 self.decoder(self.encoder(x)) 得到结果 -> 调用方收到该输出。

# 输入只用 ToTensor() 保持 [0,1]，与 Sigmoid 输出范围一致
anomaly_score = (model(images)-images).square().flatten(1).mean(1)
# [变化示例] anomaly_score=未定义/旧值 -> anomaly_score 接收 (model(images)-images).square().flatten(1).mean(1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
```

**中文解释。** 仓库将输入归一化到 `[-1,1]`，但 decoder 用 Sigmoid 限制到 `[0,1]`，目标范围不匹配。要么只 `ToTensor`，要么末层改 Tanh。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.MaxPool2d`：在局部窗口取最大值并下采样空间尺寸；无可训练参数。
- `nn.ConvTranspose2d`：可学习上采样算子；输出尺寸需用 stride、padding、kernel 和 output_padding 联合计算。
- `nn.Sigmoid`：模块形式 sigmoid，把 logits 映射到 `(0,1)`；与 BCEWithLogitsLoss 联用时不要提前 sigmoid。
- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

#### 输入与输出示例

- **输入/调用**：输入图像 `(8,1,28,28)`，encoder 得到低维 latent，decoder 重建 `(8,1,28,28)`；每样本重建误差 `(8,)` 可作为 anomaly score。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 58. Benchmark Training and Evaluation

**Problem.** Time training/evaluation accurately and report classification accuracy.

**中文题意。** 分别测量训练与测试耗时；GPU 上必须同步，否则只测到异步 kernel launch 时间。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\text{throughput}=\frac{N_{samples}}{t},\qquad \text{accuracy}=\frac{\#correct}{N}
$$

- **公式 / 不变量。** 训练 benchmark 关注速度与资源，评估关注固定数据上的指标；二者都需要排除 warmup 和数据泄漏。
- **算法拆解。** 训练模式计时并同步 GPU，评估模式配合 no_grad，累计加权 loss 和正确数；不能平均 batch 均值而忽略最后小 batch。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def timed_epoch(model, loader, train=False):
    # train=False 时同时关闭训练模式和梯度记录
    model.train(train)
    # [变化示例] 执行状态：调用 model.train(train) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    if torch.cuda.is_available(): torch.cuda.synchronize()
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    start = time.perf_counter()
    # [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
    with torch.set_grad_enabled(train):
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for x, y in loader:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            logits = model(x.to(device)); loss = F.cross_entropy(logits, y.to(device))
            # [变化示例] logits=未定义/旧值 -> logits 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
            if train:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                optimizer.zero_grad(); loss.backward(); optimizer.step()
                # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
    if torch.cuda.is_available(): torch.cuda.synchronize()
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    return time.perf_counter()-start
    # [变化示例] 函数内部：time.perf_counter()-start；数值示例：3 - 2 -> 1 -> 调用方收到该输出。
```

**中文解释。** 仓库 CPU 计时逻辑可用，但题目要求至少两个 hidden layers，模型实际只有一个；GPU benchmark 还需同步。严谨微基准可用 `torch.utils.benchmark` 或 CUDA Events。

#### 代码/API 逐项解释

- `torch.cuda.is_available`：检查当前环境能否使用 CUDA；它不保证显存足够，也不代表某个特定 kernel 可用。
- `torch.cuda.synchronize`：等待当前 CUDA 工作完成；GPU 操作异步，精确计时前后必须同步。
- `torch.set_grad_enabled`：依据布尔值动态开启/关闭梯度；同一循环可在 train/eval 模式复用而不构建无用图。
- `F.cross_entropy`：直接接收未归一化 logits 与整数类别标签，内部融合 `log_softmax + NLLLoss`，更稳定也更高效。
- `time.perf_counter()`：返回高分辨率单调时钟秒数，适合测量 elapsed time；它不返回日期时间。CUDA kernel 异步，因此代码必须在起止点调用 `torch.cuda.synchronize()`，否则只测到 kernel launch 时间。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。

- `.train(...)`：`.train()` 切换模块到训练模式，影响 Dropout、BatchNorm 等有模式差异的层。

#### 输入与输出示例

- **输入/调用**：loader 有 100 个 batch；train=True 时执行 backward/step，返回 epoch 平均 loss 与耗时；eval 时不构建梯度图。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 59. CIFAR-10 CNN

**Problem.** Build a CNN with convolution, pooling, and fully connected classification layers.

**中文题意。** 处理 `(B,3,32,32)` 图像，逐步提取空间特征、下采样并输出 10 类 logits。

### Reviewed Solution

#### 数学、公式与算法思路

$$
H_{out}=\left\lfloor\frac{H+2P-D(K-1)-1}{S}+1\right\rfloor
$$

- **公式 / 不变量。** CNN 通过卷积逐步提取局部特征，池化或 stride 降采样，最后分类头输出类别 logits。
- **算法拆解。** 逐层跟踪 C/H/W，卷积后激活和下采样，flatten 前动态确认尺寸；CrossEntropyLoss 输入应是原始 logits。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class CIFAR10CNN(nn.Module):
    def __init__(self):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.features = nn.Sequential(
            nn.Conv2d(3,32,3,padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        # [变化示例] self.features=未定义/旧值 -> self.features=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(64*8*8,128),
                                  nn.ReLU(), nn.Linear(128,10))
        # [变化示例] self.head=未定义/旧值 -> self.head=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
    def forward(self, x): return self.head(self.features(x))
    # [变化示例] 调用该单行函数时：函数内部：执行 self.head(self.features(x)) 得到结果 -> 调用方收到该输出。
# 尺寸图示：32x32 -> 16x16 -> 8x8 -> 10 类 logits
```

**中文解释。** 仓库模型可运行，但只有第二个卷积后做一次 pooling。修正版展示更常见的两阶段下采样；末层返回 logits，交给 CrossEntropyLoss。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.MaxPool2d`：在局部窗口取最大值并下采样空间尺寸；无可训练参数。
- `nn.Flatten`：把一段连续维合并；CNN 进入全连接层前通常保留 batch 维、展平其余维。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。

#### 输入与输出示例

- **输入/调用**：CIFAR 输入 `(32,3,32,32)` 经卷积池化和 flatten 后输出 `(32,10)` logits；argmax 得到 32 个类别 id。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 60. Automatic Mixed Precision

**Problem.** Use autocast and gradient scaling for stable mixed-precision training.

**中文题意。** 前向在低精度上下文运行，反向前放大 loss，step 时由 scaler 检查溢出并更新缩放系数。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\theta\leftarrow\theta-\eta\,\operatorname{unscale}\!\left(\nabla_\theta(s\mathcal{L})\right)
$$

- **公式 / 不变量。** AMP 用低精度加速多数算子，并用 GradScaler 放大 loss，避免 FP16 小梯度下溢。
- **算法拆解。** autocast 包裹 forward/loss，scale 后 backward，step 前 unscale 以便裁剪，最后 update scale；评估无需 scaler。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# [变化示例] device=未定义/旧值 -> device=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
scaler = torch.amp.GradScaler("cuda", enabled=device.type=="cuda")
# [变化示例] scaler=未定义/旧值 -> scaler 接收 torch.amp.GradScaler("cuda", enabled=device.type=="cuda") 的返回值；用 shape/dtype/device 与示例输入核对变化。
for x, y in loader:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    x, y = x.to(device), y.to(device)
    # [变化示例] x, y=未定义/旧值 -> x, y 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    optimizer.zero_grad(set_to_none=True)
    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
    with torch.autocast(device_type=device.type, dtype=torch.float16,
                        enabled=device.type=="cuda"):
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        loss = criterion(model(x), y)
        # [变化示例] loss=未定义/旧值 -> loss 接收 criterion(model(x), y) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    # 先缩放 loss 保护小梯度，再由 scaler 安全执行参数更新
    scaler.scale(loss).backward()
    # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
    scaler.step(optimizer); scaler.update()
    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
```

**中文解释。** 仓库 CUDA 版本逻辑正确但使用旧 API，并强制 `.cuda()`，无 GPU 时无法运行。修正版可按设备启停 AMP。

#### 代码/API 逐项解释

- `torch.device`：描述计算设备，如 `cpu`、`cuda`；张量和模型参数必须位于兼容设备才能运算。
- `torch.cuda.is_available`：检查当前环境能否使用 CUDA；它不保证显存足够，也不代表某个特定 kernel 可用。
- `torch.amp.GradScaler`：缩放 loss 防止 fp16 小梯度下溢；在 `step` 前自动 unscale，并在溢出时跳过参数更新。
- `torch.autocast`：在选定设备上按算子自动选择较低或较高精度，以减少显存和提升吞吐，同时保留敏感算子的稳定性。
- `torch.float16`：IEEE 半精度浮点 dtype，指数/尾数范围都小于 float32，可减少显存和提高 Tensor Core 吞吐，但小梯度易下溢、大值易溢出；因此训练通常配合 autocast 和 GradScaler，而不是把整个模型无条件转成 fp16。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。

- `.scale(...)`：GradScaler `.scale(loss)` 放大 loss 后再 backward，使 fp16 梯度尽量落在可表示范围。
- `.update(...)`：GradScaler `.update()` 根据本轮是否溢出调整缩放因子，必须在 step 之后调用。

#### 输入与输出示例

- **输入/调用**：CUDA 输入 fp32 batch；autocast 让部分矩阵乘用 fp16，loss 仍可保持 fp32；GradScaler 完成缩放 backward 和安全 step。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 61. Dynamic Quantization of an LSTM LM

**Problem.** Quantize LSTM/Linear weights dynamically for CPU inference.

**中文题意。** 语言模型训练时输出 logits；训练完成后切到 eval/CPU，并动态量化 LSTM 和 Linear 权重。

### Reviewed Solution

#### 数学、公式与算法思路

$$
W_q=\operatorname{round}(W/s),\qquad y\approx s\,(W_qx)+b
$$

- **公式 / 不变量。** 动态量化通常只把权重量化为 INT8，激活在运行时动态确定 scale，适合线性层和 LSTM 的 CPU 推理。
- **算法拆解。** 先 eval 并在 CPU 上替换支持的模块，比较模型大小、延迟和精度；量化对象与 backend 必须支持。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class LanguageModel(nn.Module):
    def __init__(self, vocab, embed, hidden):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.embedding = nn.Embedding(vocab, embed)
        # [变化示例] self.embedding=未定义/旧值 -> self.embedding=Embedding 查表模块；token ids shape (B,S) -> 输出 (B,S,D)。
        self.lstm = nn.LSTM(embed, hidden, batch_first=True)
        # [变化示例] self.lstm=未定义/旧值 -> self.lstm 接收 nn.LSTM(embed, hidden, batch_first=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.fc = nn.Linear(hidden, vocab)
        # [变化示例] self.fc=未定义/旧值 -> self.fc=线性映射模块；输入最后一维 hidden -> 输出最后一维 vocab。
    def forward(self, ids):
        out, _ = self.lstm(self.embedding(ids))
        # [变化示例] out, _=未定义/旧值 -> out, _ 接收 self.lstm(self.embedding(ids)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return self.fc(out[:,-1])  # 返回 logits，不在模型里 Softmax
        # [变化示例] 函数内部：执行 self.fc(out[:,-1]) 得到结果 -> 调用方收到该输出。

model.eval().cpu()
# [变化示例] 模块模式：旧 train/eval 标志 -> 评估模式，影响 Dropout/BatchNorm。
quantized = torch.ao.quantization.quantize_dynamic(model, {nn.LSTM,nn.Linear},
                                                   dtype=torch.qint8)
# [变化示例] quantized=未定义/旧值 -> quantized 接收 torch.ao.quantization.quantize_dynamic(model, {nn.LSTM,nn.L... 的返回值；用 shape/dtype/device 与示例输入核对变化。
```

**中文解释。** 仓库在模型中先 Softmax，再交给 `CrossEntropyLoss`，这是错误组合，因为该 loss 需要 raw logits。动态量化主要面向 CPU inference，不用于继续训练。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Embedding`：把整数 token id `(...,)` 查表为 `(...,D)`；本质是权重矩阵的行索引。
- `nn.LSTM`：带输入门、遗忘门、输出门和 cell state 的循环层；输出包括所有时间步输出及最终 `(h,c)`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.ao.quantization.quantize_dynamic`：把支持的权重密集算子动态量化；激活在运行时量化，CPU 模型通常受益更明显。
- `torch.qint8`：PyTorch 量化算子使用的有符号 8 位量化 dtype，内部同时携带量化参数。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.eval(...)`：`.eval()` 等价于 `train(False)`；它不自动关闭梯度，推理仍应配合 inference_mode/no_grad。
- `.cpu(...)`：`.cpu()` 把张量迁移到 CPU；若原张量在 GPU，会发生设备间复制和同步。

#### 输入与输出示例

- **输入/调用**：token ids `(B,S)` 经 embedding/LSTM/Linear 输出 `(B,S,V)`；动态量化后 LSTM/Linear 权重为 qint8，接口 shape 不变。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 62. RNN from Scratch

**Problem.** Implement the recurrent hidden-state update manually and predict from the final state.

**中文题意。** 对每个时间步执行 `h_t=tanh(x_t Wxh+h_{t-1}Whh+b)`，最后把 hidden state 映射为预测。

### Reviewed Solution

#### 数学、公式与算法思路

$$
h_t=\tanh(W_{xh}x_t+W_{hh}h_{t-1}+b_h),\qquad y_t=W_{hy}h_t+b_y
$$

- **公式 / 不变量。** RNN 用隐藏状态递归压缩历史；同一参数在所有时间步共享。
- **算法拆解。** 初始化 h0，按时间顺序更新 hidden 并生成输出，最后 stack；长序列会出现梯度消失或爆炸。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class ManualRNN(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.hidden_dim = hidden_dim
        # [变化示例] self.hidden_dim=未定义/旧值 -> self.hidden_dim=hidden_dim；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.Wx = nn.Parameter(torch.randn(input_dim,hidden_dim)*0.1)
        # [变化示例] self.Wx=未定义/旧值 -> self.Wx=注册后的可训练参数；原 tensor shape/dtype/device 保持，默认 requires_grad -> True。
        self.Wh = nn.Parameter(torch.randn(hidden_dim,hidden_dim)*0.1)
        # [变化示例] self.Wh=未定义/旧值 -> self.Wh=注册后的可训练参数；原 tensor shape/dtype/device 保持，默认 requires_grad -> True。
        self.b = nn.Parameter(torch.zeros(hidden_dim))
        # [变化示例] self.b=未定义/旧值 -> self.b=注册后的可训练参数；原 tensor shape/dtype/device 保持，默认 requires_grad -> True。
        self.out = nn.Linear(hidden_dim, output_dim)
        # [变化示例] self.out=未定义/旧值 -> self.out=线性映射模块；输入最后一维 hidden_dim -> 输出最后一维 output_dim。
    def forward(self, x):
        # 初始 hidden state 必须与输入同 device、同 dtype
        h = x.new_zeros(x.size(0), self.hidden_dim)
        # [变化示例] h=未定义/旧值 -> h=指定轴长度；例如 shape=(2,3,4)，size(0) -> 对应维长度。
        for t in range(x.size(1)):
            # [变化示例] 循环示例：range(x.size(1) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            h = torch.tanh(x[:,t] @ self.Wx + h @ self.Wh + self.b)
            # [变化示例] h=未定义/旧值 -> h 接收 torch.tanh(x[:,t] @ self.Wx + h @ self.Wh + self.b) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return self.out(h)
        # [变化示例] 函数内部：执行 self.out(h) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库答案正确，并正确让初始 hidden state 跟随输入 device。长序列中普通 RNN 容易梯度消失，LSTM/GRU 用门控缓解。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Parameter`：被 Module 自动注册的可训练张量；默认 `requires_grad=True`，会被优化器发现。
- `torch.randn`：从标准正态分布 N(0,1) 创建指定 shape 的张量；初始化参数时还应结合 fan-in/fan-out 缩放。
- `torch.zeros`：创建指定 shape 的全 0 张量；生产代码通常显式给出 `device` 和 `dtype`，避免默认落在 CPU/float32。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.tanh`：把数值压到 `(-1,1)`，且以 0 为中心；RNN 候选状态常用它控制幅度。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。

#### 输入与输出示例

- **输入/调用**：输入序列 `(B=3,S=5,Din=4)`、hidden=8；初始 h 为 `(3,8)`，循环 5 步后输出序列 `(3,5,8)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 63. Custom Autograd Learned-SiLU

**Problem.** Implement `slope*x*sigmoid(x)` with a custom backward pass.

**中文题意。** 自定义 `autograd.Function`，同时计算输入 x 和可学习 slope 的梯度。

### Reviewed Solution

#### 数学、公式与算法思路

$$
y=x\,\sigma(ax),\qquad \frac{\partial y}{\partial x}=\sigma(ax)+ax\sigma(ax)(1-\sigma(ax))
$$

- **公式 / 不变量。** 自定义 autograd 必须让 backward 返回与 forward 每个输入一一对应的梯度，并正确处理广播求和。
- **算法拆解。** forward 保存 backward 必需的 tensor；backward 用链式法则乘 grad_output，分别计算 x 与参数 a 的梯度。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class LearnedSiLU(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, slope):
        ctx.save_for_backward(x, slope)
        # [变化示例] 执行状态：调用 ctx.save_for_backward(x, slope) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        return slope * x * torch.sigmoid(x)
        # [变化示例] 函数内部：slope * x * torch.sigmoid(x)；数值示例：2 * 3 -> 6 -> 调用方收到该输出。
    @staticmethod
    def backward(ctx, grad_out):
        x, slope = ctx.saved_tensors
        # [变化示例] x, slope=未定义/旧值 -> x, slope=ctx.saved_tensors；这是一次重新绑定/状态更新，右侧值决定新状态。
        s = torch.sigmoid(x)
        # [变化示例] s=未定义/旧值 -> s=逐元素 Sigmoid；例如 [-1,0,1] -> 约 [0.269,0.5,0.731]。
        grad_x = grad_out * slope * (s + x*s*(1-s))
        # [变化示例] grad_x=未定义/旧值 -> grad_x=grad_out * slope * (s + x*s*(1-s))；数值示例：2 * 3 -> 6。
        # slope 可能是标量参数，必须把广播后的梯度求和回原形状
        grad_slope = (grad_out*x*s).sum_to_size(slope.shape)
        # [变化示例] grad_slope=未定义/旧值 -> grad_slope 接收 (grad_out*x*s).sum_to_size(slope.shape) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return grad_x, grad_slope
        # [变化示例] 函数内部：tuple (grad_x, grad_slope)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。
```

**中文解释。** 仓库未正确保存 slope tensor，且 `grad_slope` 形状可能与参数不符，后面还访问不存在的 `model.linear`。修正版满足 autograd 的形状 contract。

#### 代码/API 逐项解释

- `torch.autograd.Function`：自定义 autograd 的底层接口；静态 `forward` 保存 backward 所需信息，静态 `backward` 必须按输入顺序返回梯度。
- `torch.sigmoid`：把任意实数压到 `(0,1)`；大正数接近 1、大负数接近 0，可解释为二分类概率或门值。

- **自定义 backward contract**：forward 有 `(x,slope)` 两个输入，所以 backward 必须返回两个梯度；每个梯度 shape 必须能与对应输入一致。
- `ctx.saved_tensors`：只取回 forward 显式保存的 x/slope；这些值用于解析求导，不能在 forward 后原地修改。
- `.save_for_backward(...)`：`ctx.save_for_backward(...)` 保存 backward 必需张量；自定义 autograd 不应把大张量随意挂到 ctx 普通属性。
- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。
- `.sum_to_size(...)`：`.sum_to_size(shape)` 把 broadcasting 后的梯度沿扩展轴求和回原参数 shape。

#### 输入与输出示例

- **输入/调用**：输入 x `(4,)` 和可学习 beta 标量；forward 输出 `x*sigmoid(beta*x)`，backward 必须分别返回 `grad_x` 与汇总后的 `grad_beta`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 64. GAN

**Problem.** Alternate discriminator and generator updates on real and generated samples.

**中文题意。** 判别器学习区分真假，生成器学习让假样本被判为真；两个优化步骤必须隔离梯度。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\min_G\max_D\ \mathbb{E}_{x\sim p_{data}}\log D(x)+\mathbb{E}_{z\sim p(z)}\log(1-D(G(z)))
$$

- **公式 / 不变量。** GAN 是生成器与判别器的对抗博弈；实践中常用带 logits 的稳定 BCE 形式。
- **算法拆解。** 先 detach 假样本更新 D，再冻结或清理 D 梯度更新 G；两次 backward 的计算图边界必须清楚。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
# 判别器末层返回 logits，使用更稳定的 BCEWithLogitsLoss
loss_fn = nn.BCEWithLogitsLoss()
# [变化示例] loss_fn=未定义/旧值 -> loss_fn 接收 nn.BCEWithLogitsLoss() 的返回值；用 shape/dtype/device 与示例输入核对变化。
optimizer_D.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
d_loss = loss_fn(D(real), torch.ones_like(D(real))) + \
         loss_fn(D(G(z).detach()), torch.zeros_like(D(real)))
# [变化示例] d_loss=未定义/旧值 -> d_loss=loss_fn(D(real), torch.ones_like(D(real))) + \ loss_fn(D(G(z).d...；数值示例：2 + 3 -> 5。
d_loss.backward(); optimizer_D.step()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

optimizer_G.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
fake_logits = D(G(z))  # 此处不能 detach，梯度需要回到 G
# [变化示例] fake_logits=未定义/旧值 -> fake_logits 接收 D(G(z)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
g_loss = loss_fn(fake_logits, torch.ones_like(fake_logits))
# [变化示例] g_loss=未定义/旧值 -> g_loss 接收 loss_fn(fake_logits, torch.ones_like(fake_logits)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
g_loss.backward(); optimizer_G.step()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
```

**中文解释。** 仓库 Sigmoid+BCELoss 在数学上正确，但 logits 版本数值更稳定。训练 D 时 detach G 输出；训练 G 时保留完整图。

#### 代码/API 逐项解释

- `nn.BCEWithLogitsLoss`：稳定融合 sigmoid 与二元交叉熵，输入应是 raw logits，目标通常是 0/1 浮点张量。
- `torch.ones_like`：创建与参照张量相同 shape、dtype、device 的全 1 张量，常用于标签、mask 或默认乘法因子。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.step(...)`：优化器 `.step()` 根据当前 `.grad` 更新参数；AMP 时通常由 GradScaler 包装调用。

#### 输入与输出示例

- **输入/调用**：真实 batch `(16,...)` 标签全 1，生成 batch标签全 0；判别器返回 `(16,1)` logits，生成器目标使用全 1 欺骗判别器。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 65. Seq2Seq with Bahdanau-Style Attention

**Problem.** Encode a source sequence and decode tokens using attention over encoder outputs.

**中文题意。** Encoder LSTM 输出整段 memory；Decoder 每步根据 hidden state 对 source positions 计算权重和 context。

### Reviewed Solution

#### 数学、公式与算法思路

$$
e_{t,s}=v^\top\tanh(W_hh_s+W_ss_{t-1}),\quad \alpha_{t}=\operatorname{softmax}(e_t),\quad c_t=\sum_s\alpha_{t,s}h_s
$$

- **公式 / 不变量。** Bahdanau attention 用加性打分让解码器每一步动态聚合编码器状态。
- **算法拆解。** 编码源序列，解码每步用上一 hidden 计算 score，mask padding、归一化得 context，再预测 token。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class AdditiveAttention(nn.Module):
    def __init__(self, hidden):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.energy = nn.Linear(2*hidden, hidden)
        # [变化示例] self.energy=未定义/旧值 -> self.energy=线性映射模块；输入最后一维 2*hidden -> 输出最后一维 hidden。
        self.score = nn.Linear(hidden, 1, bias=False)
        # [变化示例] self.score=未定义/旧值 -> self.score=线性映射模块；输入最后一维 hidden -> 输出最后一维 1。
    def forward(self, query, memory, src_mask=None):
        # 将 decoder query 复制到每个 source 位置后逐位置打分
        # query:(B,H), memory:(B,S,H) -> scores:(B,S)
        q = query[:,None].expand(-1,memory.size(1),-1)
        # [变化示例] q=未定义/旧值 -> q 新增长度为 1 的轴；例如 (B,D) -> (B,1,D)，元素值不变。
        scores = self.score(torch.tanh(self.energy(torch.cat((q,memory),-1)))).squeeze(-1)
        # [变化示例] scores=未定义/旧值 -> scores 接收 self.score(torch.tanh(self.energy(torch.cat((q,memory),-1))... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        if src_mask is not None: scores = scores.masked_fill(~src_mask, float("-inf"))
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        weights = torch.softmax(scores,-1)
        # [变化示例] weights=未定义/旧值 -> weights=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
        return torch.bmm(weights[:,None], memory).squeeze(1), weights
        # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。
```

**中文解释。** 仓库实现对固定 source length 可用，但把注意力输出维度写死为 `src_seq_length`，无法自然支持变长与 padding。修正版逐位置打分并支持 mask。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.tanh`：把数值压到 `(-1,1)`，且以 0 为中心；RNN 候选状态常用它控制幅度。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.bmm`：批量矩阵乘法，只接收 3D 张量：`(B,M,K) @ (B,K,N) -> (B,M,N)`，不会自动 broadcast batch。
- `.expand(...)`：`.expand(...)` 用 stride=0 创建广播视图而不复制；不能把它当成独立存储原地写。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：encoder states `(B,Src,H)`、decoder hidden `(B,H)`；attention 权重 `(B,Src)` 和为 1，context 输出 `(B,H)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 66. Transformer Encoder from Scratch

**Problem.** Combine positional encoding, MHA, FFN, residuals, normalization, and padding masks.

**中文题意。** 搭建完整 encoder block，并确保 padding token 不参与 key/value attention。

### Reviewed Solution

#### 数学、公式与算法思路

$$
X'=\operatorname{LN}(X+\operatorname{MHA}(X)),\qquad Y=\operatorname{LN}(X'+\operatorname{FFN}(X'))
$$

- **公式 / 不变量。** Encoder block 通过自注意力混合 token，再通过 FFN 独立变换每个 token；残差要求维度一致。
- **算法拆解。** 构造 padding mask，执行多头自注意力、残差归一化、FFN、残差归一化；核对 Post-LN 或 Pre-LN 约定。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class EncoderBlock(nn.Module):
    def __init__(self, d_model, heads, d_ff):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.attn = nn.MultiheadAttention(d_model, heads, batch_first=True)
        # [变化示例] self.attn=未定义/旧值 -> self.attn 接收 nn.MultiheadAttention(d_model, heads, batch_first=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.ff = nn.Sequential(nn.Linear(d_model,d_ff),nn.ReLU(),nn.Linear(d_ff,d_model))
        # [变化示例] self.ff=未定义/旧值 -> self.ff=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        self.n1, self.n2 = nn.LayerNorm(d_model), nn.LayerNorm(d_model)
        # [变化示例] self.n1, self.n2=未定义/旧值 -> self.n1, self.n2=LayerNorm 模块；例如输入 (...,D) -> 输出仍为 (...,D)，最后一维被归一化。
    def forward(self, x, padding_mask=None):
        # key_padding_mask=True 表示该 key 不可见
        a, _ = self.attn(self.n1(x),self.n1(x),self.n1(x),
                         key_padding_mask=padding_mask, need_weights=False)
        # [变化示例] a, _=未定义/旧值 -> a, _ 接收 self.attn(self.n1(x),self.n1(x),self.n1(x), key_padding_mas... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = x + a
        # [变化示例] x=未定义/旧值 -> x=x + a；数值示例：2 + 3 -> 5。
        return x + self.ff(self.n2(x))
        # [变化示例] 函数内部：x + self.ff(self.n2(x))；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** 仓库核心 block 正确，但题面要求 padding 支持，答案却没有把 mask 传入 attention。修正版补上这一关键路径。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.MultiheadAttention`：官方多头注意力层；必须核对 `batch_first`、mask 形状和布尔 mask 语义。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.LayerNorm`：对每个样本最后若干维独立归一化，训练和推理均使用当前输入统计。

#### 输入与输出示例

- **输入/调用**：输入 `(B=2,S=12,D=64)` 与 padding mask；MHA、FFN、两次 residual/norm 后输出仍为 `(2,12,64)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 67. Grad-CAM

**Problem.** Use target-layer activations and class gradients to produce a localization heatmap.

**中文题意。** 保存卷积激活及其梯度，按空间平均梯度作为 channel 权重，得到 ReLU 后的热力图。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\alpha_k^c=\frac1{HW}\sum_{i,j}\frac{\partial y^c}{\partial A_{ij}^k},\qquad L_{GradCAM}^c=\operatorname{ReLU}\!\left(\sum_k\alpha_k^cA^k\right)
$$

- **公式 / 不变量。** Grad-CAM 用目标类别对特征图的梯度作为通道重要性，再加权特征图生成定位热图。
- **算法拆解。** hook 目标卷积层的 activation 与 gradient，反传类别分数，空间平均梯度，加权求和、ReLU、上采样。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
activations = gradients = None
# [变化示例] activations=未定义/旧值 -> 链式赋值 activations=gradients = None；等号两侧目标最终引用同一给定值。
def forward_hook(_m,_i,out):
    global activations, gradients
    activations = out
    # [变化示例] activations=未定义/旧值 -> activations=out；这是一次重新绑定/状态更新，右侧值决定新状态。
    out.register_hook(lambda g: globals().__setitem__("gradients", g))
    # [变化示例] 执行状态：调用 out.register_hook(lambda g: globals().__setitem__("gradient... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

handle = model.layer4[-1].register_forward_hook(forward_hook)
# [变化示例] handle=未定义/旧值 -> handle=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
logits = model(image)
# [变化示例] logits=未定义/旧值 -> logits 接收 model(image) 的返回值；用 shape/dtype/device 与示例输入核对变化。
model.zero_grad(set_to_none=True)
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
logits[0, logits.argmax(1)].backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
weights = gradients.mean((2,3), keepdim=True)
# [变化示例] weights=未定义/旧值 -> weights=沿指定维求均值；例如 [1,2,3] -> 2。
cam = (weights*activations).sum(1).relu()
# [变化示例] cam=未定义/旧值 -> cam 接收 (weights*activations).sum(1).relu() 的返回值；用 shape/dtype/device 与示例输入核对变化。
cam = cam / cam.amax((1,2), keepdim=True).clamp_min(1e-8)
# [变化示例] cam=未定义/旧值 -> cam=cam / cam.amax((1,2), keepdim=True).clamp_min(1e-8)；数值示例：6 / 3 -> 2。
handle.remove()  # hook 用完必须移除
```

**中文解释。** 仓库使用已弃用的 module backward hook，并把已归一化 tensor 转 PIL 后再次归一化。修正版直接在 activation tensor 注册梯度 hook，并安全归一化热图。

#### 代码/API 逐项解释

- `.register_hook(...)`：张量 `.register_hook` 在其梯度生成时执行回调；可捕获中间激活梯度。
- `.register_forward_hook(...)`：`.register_forward_hook` 在模块 forward 后取得输入输出；Grad-CAM 用它保存 feature map，结束后要 remove。
- `.zero_grad(...)`：`.zero_grad()` 清除或置空旧梯度；梯度默认累加，因此每次独立 optimizer step 前通常需要调用。
- `.argmax(...)`：`.argmax(dim)` 返回最大值索引；分类输出是类别 id，K-Means 则是最近中心 id。
- `.backward(...)`：`.backward()` 从标量 loss 反传，并把梯度累加到叶子参数 `.grad`；不会自动清零。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `handle.remove()`：解除 `register_forward_hook` 返回的 hook handle；若不移除，后续每次 forward 都会继续执行回调，可能重复保存激活、持有引用并造成内存泄漏。

- `.relu(...)`：`.relu()`/`torch.relu` 逐元素把负数置 0；不会改变 shape。

#### 输入与输出示例

- **输入/调用**：分类模型输入 `(1,3,H,W)`；hook 保存 feature `(1,C,h,w)` 与其梯度，通道权重平均后得到 Grad-CAM `(1,1,h,w)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 68. 3D CNN Segmentation

**Problem.** Combine slice-wise 2D features with 3D convolutions and optimize Dice loss.

**中文题意。** 对体数据保持统一 `(B,C,D,H,W)` 布局，输出同布局二值 segmentation logits。

### Reviewed Solution

#### 数学、公式与算法思路

$$
Y_{n,o,d,h,w}=\sum_c\sum_u\sum_v\sum_r W_{o,c,u,v,r}X_{n,c,d+u,h+v,w+r}
$$

- **公式 / 不变量。** 3D CNN 同时在深度、高度、宽度上卷积，适合体数据；分割输出需恢复到输入空间分辨率。
- **算法拆解。** 编码器降采样提语义，解码器上采样并融合 skip features，最后逐体素分类；拼接前尺寸必须对齐。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class Small3DSegmenter(nn.Module):
    def __init__(self, in_channels=1):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.net = nn.Sequential(nn.Conv3d(in_channels,16,3,padding=1),nn.ReLU(),
                                 nn.Conv3d(16,16,3,padding=1),nn.ReLU(),
                                 nn.Conv3d(16,1,1))
        # [变化示例] self.net=未定义/旧值 -> self.net=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
    def forward(self,x): return self.net(x)  # 返回 logits
    # [变化示例] 调用该单行函数时：函数内部：执行 self.net(x) 得到结果 -> 调用方收到该输出。

def dice_loss(logits, target, eps=1e-6):
    pred = logits.sigmoid()
    # [变化示例] pred=未定义/旧值 -> pred=逐元素 Sigmoid；例如 [-1,0,1] -> 约 [0.269,0.5,0.731]。
    dims = tuple(range(1,pred.ndim))
    # [变化示例] dims=未定义/旧值 -> dims 接收 tuple(range(1,pred.ndim)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    dice = (2*(pred*target).sum(dims)+eps)/(pred.sum(dims)+target.sum(dims)+eps)
    # [变化示例] dice=未定义/旧值 -> dice=(2*(pred*target).sum(dims)+eps)/(pred.sum(dims)+target.sum(dims...；数值示例：6 / 3 -> 2。
    return 1-dice.mean()  # 最小化 1-Dice，不是 Dice coefficient
    # [变化示例] 函数内部：1-dice.mean()；数值示例：3 - 2 -> 1 -> 调用方收到该输出。
```

**中文解释。** 仓库 mask 布局为 `(B,D,1,H,W)`、输出为 `(B,1,D,H,W)`，会错误广播；还把 Dice coefficient 当 loss 最小化，方向相反。这里修正两处严重错误。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv3d`：三维卷积，典型输入 `(B,Cin,D,H,W)`，用于体数据或时空局部特征。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。

- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。

#### 输入与输出示例

- **输入/调用**：体数据输入 `(2,1,D=16,H=64,W=64)`；模型输出 logits `(2,num_classes,16,64,64)`，Dice loss 输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 69. AlexNet

**Problem.** Recreate the five-convolution, three-linear AlexNet classifier.

**中文题意。** 输入 224x224 RGB 图像，经 5 个卷积和 3 个全连接层输出类别 logits。

### Reviewed Solution

#### 数学、公式与算法思路

$$
227\times227\xrightarrow{11,s=4}55\times55\xrightarrow{pool}27\times27
$$

- **公式 / 不变量。** AlexNet 用大卷积核和多次池化快速降采样，随后全连接层完成分类。
- **算法拆解。** 按经典顺序跟踪空间尺寸和通道数，卷积后 ReLU/LRN 或现代替代，分类头前 flatten；输入尺寸会影响首层结果。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class AlexNetCompact(nn.Module):
    def __init__(self, classes=10):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.features = nn.Sequential(
            nn.Conv2d(3,96,11,4,2),nn.ReLU(),nn.MaxPool2d(3,2),
            nn.Conv2d(96,256,5,padding=2),nn.ReLU(),nn.MaxPool2d(3,2),
            nn.Conv2d(256,384,3,padding=1),nn.ReLU(),
            nn.Conv2d(384,384,3,padding=1),nn.ReLU(),
            nn.Conv2d(384,256,3,padding=1),nn.ReLU(),nn.MaxPool2d(3,2))
        # [变化示例] self.features=未定义/旧值 -> self.features=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        self.head = nn.Sequential(nn.Flatten(),nn.Dropout(),nn.Linear(256*6*6,4096),
                                  nn.ReLU(),nn.Dropout(),nn.Linear(4096,4096),
                                  nn.ReLU(),nn.Linear(4096,classes))
        # [变化示例] self.head=未定义/旧值 -> self.head=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
    def forward(self,x):
        # 卷积提取空间特征，展平后由三层分类头输出 logits
        return self.head(self.features(x))
        # [变化示例] 函数内部：执行 self.head(self.features(x)) 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库架构正确。CIFAR-10 必须先 resize 到 224；500 epochs 很昂贵，只是示例配置而非必要条件。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `nn.MaxPool2d`：在局部窗口取最大值并下采样空间尺寸；无可训练参数。
- `nn.Flatten`：把一段连续维合并；CNN 进入全连接层前通常保留 batch 维、展平其余维。
- `nn.Dropout`：训练时按概率 p 置零并除以 `1-p` 保持期望，eval 时原样返回。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。

#### 输入与输出示例

- **输入/调用**：输入 `(B,3,224,224)` 经五层卷积/池化和 classifier 后输出 `(B,num_classes)` logits。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 70. CNN Initialization Strategies

**Problem.** Compare zero, random, Xavier, and Kaiming initialization.

**中文题意。** 对 Conv/Linear 应用不同初始化，并理解对称性、信号方差和激活函数匹配。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\operatorname{Var}(W)=\begin{cases}2/fan_{in}&\text{ReLU/Kaiming}\\2/(fan_{in}+fan_{out})&\text{Xavier normal}\end{cases}
$$

- **公式 / 不变量。** 初始化应与激活函数匹配，使前向激活和反向梯度的方差跨层尽量稳定。
- **算法拆解。** 遍历模块按类型初始化 Conv/Linear，bias 常置零；比较策略时固定数据与随机种子并观察激活/梯度统计。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def init_weights(module, kind="kaiming"):
    if not isinstance(module,(nn.Conv2d,nn.Linear)): return
    # [变化示例] 分支示例：条件 True -> 立即返回 返回值；False -> 继续执行下一行。
    if kind == "zero": nn.init.zeros_(module.weight)
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    elif kind == "random": nn.init.normal_(module.weight,0,0.01)
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    elif kind == "xavier": nn.init.xavier_normal_(module.weight)
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    elif kind == "kaiming": nn.init.kaiming_normal_(module.weight,mode="fan_in",
                                                    nonlinearity="relu")
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    else: raise ValueError("未知初始化")
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    if module.bias is not None: nn.init.zeros_(module.bias)
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
```

**中文解释。** 仓库总体正确，但 random 默认标准差 1 往往过大，Kaiming Conv 使用 `fan_out` 与前向方差目标不一致。全零初始化让同层神经元保持对称，无法学出不同特征。

#### 代码/API 逐项解释

- `nn.Conv2d`：二维卷积，典型输入 `(B,Cin,H,W)`，输出空间尺寸由 kernel/stride/padding/dilation 决定。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.init.zeros_`：原地把参数置 0；尾层或 bias 初始化常用，结尾下划线表示原地操作。
- `nn.init.normal_`：按正态分布原地初始化；需结合层宽选择标准差。
- `nn.init.xavier_normal_`：根据 fan-in 与 fan-out 缩放正态初始化，适合近似对称激活。
- `nn.init.kaiming_normal_`：根据 fan-in/out 与非线性增益初始化，常用于 ReLU 网络。

- `.zeros_(...)`：`.zeros_()` 原地清零；会修改原存储，不能破坏 backward 所需中间值。
- `.normal_(...)`：`.normal_(mean,std)` 原地填充正态随机数；参数初始化应放在 `no_grad` 中。

#### 输入与输出示例

- **输入/调用**：对 Conv2d/Linear 遍历调用初始化；权重 shape 不变但分布改变，bias 被置 0，可打印均值/std 验证。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 71. CNN Layers from Scratch

**Problem.** Use custom convolution and max-pooling modules inside the final CNN.

**中文题意。** 不允许 `nn.Conv2d/MaxPool2d`；自定义层必须真正用于模型，而不只是定义后闲置。

### Reviewed Solution

#### 数学、公式与算法思路

$$
Y=\operatorname{im2col}(X)W_{col}^\top+b
$$

- **公式 / 不变量。** 从零卷积可把每个滑动窗口展开为列，再转化成批量矩阵乘法；这解释了 unfold 的 shape。
- **算法拆解。** padding 后用 unfold 提取 patches，重排为 B×L×K，与展平卷积核相乘，再 reshape 回图像布局。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class ScratchCNN(nn.Module):
    def __init__(self):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.conv1 = Conv2dCustom(3,32,3,padding=1)
        # [变化示例] self.conv1=未定义/旧值 -> self.conv1 接收 Conv2dCustom(3,32,3,padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.conv2 = Conv2dCustom(32,64,3,padding=1)
        # [变化示例] self.conv2=未定义/旧值 -> self.conv2 接收 Conv2dCustom(32,64,3,padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.pool = MaxPool2dCustom(2,2)
        # [变化示例] self.pool=未定义/旧值 -> self.pool 接收 MaxPool2dCustom(2,2) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.head = nn.Sequential(nn.Flatten(),nn.Linear(64*16*16,128),
                                  nn.ReLU(),nn.Linear(128,10))
        # [变化示例] self.head=未定义/旧值 -> self.head=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
    def forward(self,x):
        # 修复仓库最终模型误用内置 Conv/Pool 的问题
        return self.head(self.pool(torch.relu(self.conv2(torch.relu(self.conv1(x))))))
        # [变化示例] 函数内部：执行 self.head(self.pool(torch.relu(self.conv2(torch.relu(self.c... 得到结果 -> 调用方收到该输出。
```

**中文解释。** 仓库自定义层本身基本正确，但最后 `CNNModel` 仍使用内置层，违反题目核心约束。自定义输出还应使用 `x.new_zeros` 以保持 dtype。

#### 代码/API 逐项解释

- `nn.Module`：所有可训练 PyTorch 模块的基类；子模块和 `nn.Parameter` 只有注册为属性后才会进入 `parameters()`/`state_dict()`。
- `nn.Sequential`：按声明顺序串联模块；适合无分支流水线，但 residual、多输入或多输出逻辑通常写显式 `forward`。
- `nn.Flatten`：把一段连续维合并；CNN 进入全连接层前通常保留 batch 维、展平其余维。
- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `nn.ReLU`：逐元素 `max(0,x)`；正区间梯度为 1，负区间梯度为 0。
- `torch.relu`：函数式逐元素 ReLU，计算 `max(0,x)`，输出 shape/dtype/device 与输入一致；负值梯度为 0、正值梯度为 1、零点采用梯度 0。这里用于自定义卷积层之间的激活，不会引入参数。

- `.relu(...)`：`.relu()`/`torch.relu` 逐元素把负数置 0；不会改变 shape。

#### 输入与输出示例

- **输入/调用**：输入 `(4,1,28,28)` 经自定义卷积/池化，flatten 后送 Linear，输出 `(4,num_classes)`；必须确认真正调用的是自定义层。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 72. LSTM from Scratch

**Problem.** Implement all four LSTM gates and compare with `nn.LSTM`.

**中文题意。** 手写 input/forget/output/candidate gates，更新 cell 与 hidden state，并输出每个时间步或最后一步预测。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\begin{aligned}i_t&=\sigma(W_ix_t+U_ih_{t-1})\\f_t&=\sigma(W_fx_t+U_fh_{t-1})\\g_t&=\tanh(W_gx_t+U_gh_{t-1})\\c_t&=f_t\odot c_{t-1}+i_t\odot g_t\\h_t&=o_t\odot\tanh(c_t)\end{aligned}
$$

- **公式 / 不变量。** LSTM 用遗忘、输入、输出门控制长期 cell state，缓解普通 RNN 的梯度消失。
- **算法拆解。** 每步一次仿射可同时算四组 gate，再按约定切分；初始化 h/c 并按时间迭代，注意 gate 顺序。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def lstm_step(x, h, c, Wx, Wh, b):
    # 一次算出 4H，再沿最后维拆门，效率高于四次独立 matmul
    gates = x @ Wx + h @ Wh + b
    # [变化示例] gates=未定义/旧值 -> gates=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    i, f, o, g = gates.chunk(4, dim=-1)
    # [变化示例] i, f, o, g=未定义/旧值 -> i, f, o, g 接收 gates.chunk(4, dim=-1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    i, f, o, g = i.sigmoid(), f.sigmoid(), o.sigmoid(), g.tanh()
    # [变化示例] i, f, o, g=未定义/旧值 -> i, f, o, g=逐元素 Sigmoid；例如 [-1,0,1] -> 约 [0.269,0.5,0.731]。
    c = f*c + i*g
    # [变化示例] c=未定义/旧值 -> c=f*c + i*g；数值示例：2 + 3 -> 5。
    h = o*c.tanh()
    # [变化示例] h=未定义/旧值 -> h=o*c.tanh()；数值示例：2 * 3 -> 6。
    return h, c
    # [变化示例] 函数内部：tuple (h, c)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。

# 初始状态必须确定且跟随输入设备
h = x.new_zeros(x.size(0), hidden_size)
# [变化示例] h=未定义/旧值 -> h=指定轴长度；例如 shape=(2,3,4)，size(0) -> 对应维长度。
c = x.new_zeros(x.size(0), hidden_size)
# [变化示例] c=未定义/旧值 -> c=指定轴长度；例如 shape=(2,3,4)，size(0) -> 对应维长度。
```

**中文解释。** 仓库 gate 公式正确，但每次 forward 随机初始化 h/c，导致相同输入输出不确定，并在 GPU 上 device mismatch。应从零初始化或显式传入状态。

#### 代码/API 逐项解释

- `.chunk(...)`：`.chunk(n,dim)` 尽量把某维分成 n 块；该维不能整除时块大小可能不完全相同。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。
- `.tanh(...)`：`.tanh()` 把元素映射到 `(-1,1)`；输出与输入 shape 相同。

#### 输入与输出示例

- **输入/调用**：单步输入 `x:(B,Din)`、旧状态 `h,c:(B,H)`；四个 gate 更新后返回新 `h,c`，两者 shape 都是 `(B,H)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 73. Full DPO Utilities

**Problem.** Compute sequence log-probabilities and DPO loss with a frozen reference.

**中文题意。** 对 shifted labels 求每条序列 token log-prob 总和，再计算 policy/reference 的 chosen-rejected margin。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\log\pi(y|x)=\sum_t m_t\log\operatorname{softmax}(z_t)_{y_t}
$$

- **公式 / 不变量。** 完整 DPO 工具链先可靠计算带 mask 的序列 log-prob，再构造 chosen/rejected 的参考校正偏好损失。
- **算法拆解。** shift logits/labels 对齐 next-token，忽略 padding，分别汇总四组 log-prob，再应用 DPO 公式和准确率指标。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def sequence_logps(logits, labels, mask=None):
    # token t 的 logits 预测 token t+1
    logp = F.log_softmax(logits[:,:-1],-1)
    # [变化示例] logp=未定义/旧值 -> logp=log 概率；例如 logits=[0,0] -> 约 [-0.693,-0.693]。
    chosen = logp.gather(-1,labels[:,1:,None]).squeeze(-1)
    # [变化示例] chosen=未定义/旧值 -> chosen 接收 logp.gather(-1,labels[:,1:,None]).squeeze(-1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    if mask is not None: chosen = chosen*mask[:,1:]
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    return chosen.sum(-1)
    # [变化示例] 函数内部：沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留 -> 调用方收到该输出。

def full_dpo(pc, pr, rc, rr, beta=.1):
    margin = (pc-pr) - (rc-rr).detach()
    # [变化示例] margin=未定义/旧值 -> margin=(pc-pr) - (rc-rr).detach()；数值示例：3 - 2 -> 1。
    return -F.logsigmoid(beta*margin).mean()
    # [变化示例] 函数内部：执行 -F.logsigmoid(beta*margin).mean() 得到结果 -> 调用方收到该输出。
```

**中文解释。** v3 仓库实现符合公式。关键是 sequence shift、padding mask 和 token log-prob 求和，而不是平均。

#### 代码/API 逐项解释

- `F.log_softmax`：稳定地同时完成 softmax 和 log；NLL、DPO、蒸馏等需要 log-prob 时应优先使用。
- `F.logsigmoid`：稳定计算 `log(sigmoid(x))`，比先 sigmoid 再 log 更不容易在大负数处下溢。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

#### 输入与输出示例

- **输入/调用**：logits `(B,S,V)`、labels/mask `(B,S)`；gather 得每 token log-prob，再按 mask 求 sequence log-prob `(B,)`，DPO 最终输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 74. Gradient Checkpointing

**Problem.** Save only inputs during forward and recompute the function during backward.

**中文题意。** 用额外计算换显存：forward 不保存中间激活，backward 时重新构建带梯度的计算图。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\text{memory}:O(L)\rightarrow O(\sqrt L)\ \text{approximately, at the cost of recomputation}
$$

- **公式 / 不变量。** Gradient Checkpointing 不保存部分中间激活，反向时重新执行 forward，以计算换显存。
- **算法拆解。** 把纯函数段交给 checkpoint，输入至少有需要梯度的 tensor，避免依赖不可重放副作用；训练时间会增加。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class CheckpointFn(torch.autograd.Function):
    @staticmethod
    def forward(ctx, fn, *args):
        # forward 不建立中间激活图，只保存重算所需输入
        ctx.fn = fn
        # [变化示例] ctx.fn=未定义/旧值 -> ctx.fn=fn；这是一次重新绑定/状态更新，右侧值决定新状态。
        ctx.needs = tuple(x.requires_grad for x in args)
        # [变化示例] ctx.needs=未定义/旧值 -> ctx.needs 接收 tuple(x.requires_grad for x in args) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        ctx.save_for_backward(*args)
        # [变化示例] 执行状态：调用 ctx.save_for_backward(*args) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        with torch.no_grad(): return fn(*args)
        # [变化示例] 上下文状态：进入前未启用 -> 启用上下文并执行 return fn(*args)，随后自动恢复。
    @staticmethod
    def backward(ctx, grad_out):
        args = tuple(x.detach().requires_grad_(need)
                     for x,need in zip(ctx.saved_tensors,ctx.needs))
        # [变化示例] args=未定义/旧值 -> args=逐个 detach 后按 need 开启梯度的新叶子 tensor tuple；原 saved tensor -> 可重算反向的独立输入。
        with torch.enable_grad(): out = ctx.fn(*args)
        # [变化示例] 上下文状态：进入前未启用 -> 启用上下文并执行 out = ctx.fn(*args)，随后自动恢复。
        grad_args=[x for x,need in zip(args,ctx.needs) if need]
        # [变化示例] grad_args=未定义/旧值 -> grad_args=[x for x,need in zip(args,ctx.needs) if need]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        computed=torch.autograd.grad(out,grad_args,grad_out,allow_unused=True)
        # [变化示例] computed=未定义/旧值 -> computed=指定输出对输入的梯度 tuple；例如 y=x^2,x=3,grad_out=1 -> grad=6。
        it=iter(computed)
        # [变化示例] it=未定义/旧值 -> it 接收 iter(computed) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        grads=tuple(next(it) if need else None for need in ctx.needs)
        # [变化示例] grads=未定义/旧值 -> grads=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
        return (None,*grads)
        # [变化示例] 函数内部：tuple (None,*grads)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。

def checkpoint_from_scratch(fn,*tensor_args):
    # fn 使用的所有可训练 tensor（包括 functional parameters）都必须显式传入
    return CheckpointFn.apply(fn,*tensor_args)
    # [变化示例] 函数内部：执行 CheckpointFn.apply(fn,*tensor_args) 得到结果 -> 调用方收到该输出。

# 生产代码推荐官方非 reentrant 版本，它会处理参数、嵌套结构和 RNG 状态
# y = torch.utils.checkpoint.checkpoint(module, x, use_reentrant=False)
```

**中文解释。** 自定义 `Function.backward` 只能为 `forward` 的 tensor 参数返回梯度；如果 `fn` 在闭包里偷偷捕获 `module.parameters()`，这些参数不会自动得到梯度，因此从零版本必须把所有求导 tensor 显式传入并采用 functional call。仓库的简化实现还会把 `requires_grad=False` tensor 传给 `autograd.grad` 而报错。生产环境应使用官方 `torch.utils.checkpoint.checkpoint(..., use_reentrant=False)`；它还能保存/恢复 RNG state，使包含 Dropout 的重算与原 forward 一致。“bitwise identical”并非跨所有设备/kernel 的合理承诺，应使用容差和确定性配置验证。

#### 代码/API 逐项解释

- `torch.autograd.Function`：自定义 autograd 的底层接口；静态 `forward` 保存 backward 所需信息，静态 `backward` 必须按输入顺序返回梯度。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- `torch.enable_grad`：在外层禁用梯度时临时重新开启记录；手写 gradient checkpoint backward 会重新计算 forward。
- `torch.autograd.grad`：直接返回指定输出对指定输入的梯度，不自动累加到所有 `.grad`；手写 backward/checkpoint 常使用。
- `torch.utils.checkpoint.checkpoint`：官方 activation checkpoint：forward 不保存全部中间激活，backward 时重算以用计算换显存。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。

- `.save_for_backward(...)`：`ctx.save_for_backward(...)` 保存 backward 必需张量；自定义 autograd 不应把大张量随意挂到 ctx 普通属性。
- `.requires_grad_(...)`：`.requires_grad_(True)` 原地设置是否追踪梯度；只对浮点/复数张量有效。
- `.apply(...)`：自定义 `autograd.Function.apply(...)` 是进入其 forward/backward 的正确入口，不直接实例化 Function。

#### 输入与输出示例

- **输入/调用**：函数 `fn(x)` 的 forward 不保存中间激活；backward 收到上游梯度后重算 fn，返回与 x 同 shape 的梯度，用更多计算换更少显存。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 75. Full GRPO Objective

**Problem.** Combine group-normalized advantages, PPO-style clipping, and reference KL penalty.

**中文题意。** 每个 prompt 内标准化 rewards，再用 old/new policy ratio 的 clipped objective 更新，并限制偏离 reference。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}=\mathcal{L}_{clip}+\beta_{KL}D_{KL}(\pi_\theta\Vert\pi_{ref})-c_HH(\pi_\theta)
$$

- **公式 / 不变量。** 完整 GRPO 同时包含组内 advantage、裁剪策略目标、参考模型 KL 约束，可能还加入熵奖励。
- **算法拆解。** 按 prompt 分组标准化奖励，构造 token mask 和 ratio，聚合 clipped objective 与 KL；所有均值分母要按有效 token 数。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def full_grpo(new_logp, old_logp, ref_logp, rewards, group_size,
              clip=.2, beta=.01):
    grouped = rewards.view(-1,group_size)
    # [变化示例] grouped=未定义/旧值 -> grouped 重排为 -1,group_size；元素数量与顺序保持不变（若布局允许则共享 storage）。
    adv = ((grouped-grouped.mean(1,keepdim=True)) /
           grouped.std(1,unbiased=False,keepdim=True).clamp_min(1e-6)).reshape(-1).detach()
    # [变化示例] adv=未定义/旧值 -> adv=数值相同但与当前 autograd 图断开的 tensor；grad_fn -> None。
    ratio = torch.exp(new_logp-old_logp.detach())
    # [变化示例] ratio=未定义/旧值 -> ratio=逐元素指数；例如 [0,1] -> [1,2.718]。
    pg = -torch.minimum(ratio*adv, ratio.clamp(1-clip,1+clip)*adv).mean()
    # [变化示例] pg=未定义/旧值 -> pg 接收 -torch.minimum(ratio*adv, ratio.clamp(1-clip,1+clip)*adv).m... 的返回值；用 shape/dtype/device 与示例输入核对变化。
    # Schulman 非负 KL estimator：令 r=pi_ref/pi_policy，r-log(r)-1 >= 0
    log_r = ref_logp.detach()-new_logp
    # [变化示例] log_r=未定义/旧值 -> log_r=ref_logp.detach()-new_logp；数值示例：3 - 2 -> 1。
    kl = (torch.exp(log_r)-log_r-1).mean()
    # [变化示例] kl=未定义/旧值 -> kl 接收 (torch.exp(log_r)-log_r-1).mean() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    return pg + beta*kl
    # [变化示例] 函数内部：pg + beta*kl；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** 组内 advantage 必须按 prompt 分组，不能跨 prompt 标准化。旧策略用于 PPO ratio，reference 策略用于 KL 约束，两者角色不同。简单的 `(new_logp-ref_logp).mean()` 在有限样本上可为负，不适合作为逐样本 penalty；修正版使用常见的非负 KL estimator。若有完整 vocabulary logits，直接计算 `sum p_policy(log p_policy-log p_ref)` 更清晰。

#### 代码/API 逐项解释

- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。

- `.std(...)`：`.std(dim)` 计算标准差；组内 advantage 标准化时应加 epsilon，并明确 correction 约定。
- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：每组 4 个 reward 先标准化；new/old ratio 经 clip，另加与 reference 的 KL penalty，最终输出 batch/token 平均标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 76. LoRA Injection and Merge

**Problem.** Wrap selected Linear layers with LoRA and merge the learned update back.

**中文题意。** 冻结基础 Linear，训练低秩 A/B；部署前把更新合并进原权重并移除 adapter。

### Reviewed Solution

#### 数学、公式与算法思路

$$
W_{merged}=W+sBA,\qquad W_{unmerged}=W_{merged}-sBA
$$

- **公式 / 不变量。** LoRA 注入要冻结基座参数并只训练 A/B；merge 后前向无需额外低秩分支。
- **算法拆解。** 递归替换目标 Linear，保留原权重和 bias，训练低秩支路；merge/unmerge 必须幂等并防重复操作。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class MergeableLoRA(LoRALinear):
    def merged_linear(self):
        merged = nn.Linear(self.linear.in_features,self.linear.out_features,
                           bias=self.linear.bias is not None,
                           device=self.linear.weight.device,dtype=self.linear.weight.dtype)
        # [变化示例] merged=未定义/旧值 -> merged=线性映射模块；输入最后一维 self.linear.in_features -> 输出最后一维 self.linear.out_features。
        with torch.no_grad():
            # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
            # Linear weight 布局是 (Dout,Din)：delta_W = B @ A
            merged.weight.copy_(self.linear.weight + self.scaling*self.lora_B@self.lora_A)
            # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 merged.weight.copy_(self.linear.weight + self.scaling*s... 后直接覆盖同一 storage。
            if merged.bias is not None: merged.bias.copy_(self.linear.bias)
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        return merged
        # [变化示例] 函数内部：merged；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** v3 方案总体正确。合并前后应在 eval mode 下比较输出，尤其当外围模型含 Dropout 时；替换嵌套模块时要保留 device/dtype。

#### 代码/API 逐项解释

- `nn.Linear`：仿射层，输入 `(...,Din)` 输出 `(...,Dout)`；内部权重 shape 为 `(Dout,Din)`。
- `torch.no_grad`：上下文内不记录 autograd 图；用于参数原地更新、评估或权重合并，减少内存并避免错误梯度边。
- **`@` 矩阵乘法**：最后两维按矩阵规则收缩，前导维按 broadcasting 处理；必须满足左侧最后一维等于右侧倒数第二维。

- `.copy_(...)`：`.copy_(source)` 原地复制数值但保留目标对象身份；加载或合并权重时常在 `no_grad` 中使用。

#### 输入与输出示例

- **输入/调用**：base weight `(Dout,Din)`、A `(r,Din)`、B `(Dout,r)`；merge 后 `W += scale*(B@A)`，同一输入的 eval 输出应与未 merge LoRA 路径接近。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 77. PPO-RLHF Core

**Problem.** Implement GAE, clipped policy loss, value loss, and reference KL control.

**中文题意。** 用 value baseline 计算时序 advantage，限制 policy ratio，联合训练 critic，并惩罚偏离 reference。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\delta_t=r_t+\gamma V_{t+1}-V_t,\qquad A_t=\delta_t+\gamma\lambda(1-d_t)A_{t+1}
$$

- **公式 / 不变量。** PPO-RLHF 先用 GAE 从奖励和 value 估计 advantage，再联合优化裁剪策略损失、value loss 与熵/KL 项。
- **算法拆解。** 从序列末尾反推 GAE，done 后不 bootstrap；计算 ratio、clipped policy loss 和 value loss，按 mask 聚合。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def compute_gae(rewards, values, dones, gamma=.99, lam=.95):
    # 从最后时间步向前递推，done 位置会截断 bootstrap
    adv = torch.zeros_like(rewards); last = 0
    # [变化示例] adv=未定义/旧值 -> adv=全 0 张量；shape 与参照张量相同。
    next_value = torch.zeros_like(values[:,0])
    # [变化示例] next_value=未定义/旧值 -> next_value=全 0 张量；shape 与参照张量相同。
    for t in reversed(range(rewards.size(1))):
        # [变化示例] 循环示例：range(rewards.size(1) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        alive = 1.0-dones[:,t]
        # [变化示例] alive=未定义/旧值 -> alive=1.0-dones[:,t]；数值示例：3 - 2 -> 1。
        delta = rewards[:,t] + gamma*next_value*alive - values[:,t]
        # [变化示例] delta=未定义/旧值 -> delta=rewards[:,t] + gamma*next_value*alive - values[:,t]；数值示例：2 + 3 -> 5。
        last = delta + gamma*lam*alive*last
        # [变化示例] last=未定义/旧值 -> last=delta + gamma*lam*alive*last；数值示例：2 + 3 -> 5。
        adv[:,t] = last; next_value = values[:,t]
        # [变化示例] 目标切片 adv[:,t]=旧值 -> last; next_value = values[:,t]；base tensor 对应位置同步被写入。
    return adv, adv+values
    # [变化示例] 函数内部：tuple (adv, adv+values)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。

# loss = clipped policy loss + c_v*MSE(value,return) + beta*KL - c_e*entropy
```

**中文解释。** 仓库展示了完整组件。真实 RLHF 必须正确处理 EOS/padding mask、旧策略快照、token-level rewards、advantage normalization 和多 epoch minibatch 更新。

#### 代码/API 逐项解释

- `values[:, 0]`：假设 `values.shape=(B,T)`，第一个 `:` 选择全部 B 个样本，整数 `0` 选择每个样本的第 0 个时间步，因此结果 shape 从 `(B,T)` 变为 `(B,)`。例如 `values=[[0.5,0.4,0.2],[1.0,0.8,0.3]]` 时，`values[:,0] -> [0.5,1.0]`。
- `torch.zeros_like(values[:, 0])`：先得到 shape 为 `(B,)` 的首列模板，再创建同 shape、dtype、device 的 0；这里代表序列末端之后的 bootstrap value 初值。若 values 在 CUDA/bfloat16，结果也自动在 CUDA/bfloat16。
- `last = 0` 与 `next_value`：`last` 会在第一次张量运算后广播/变成每个 batch 的 advantage accumulator；写成 `torch.zeros_like(values[:,0])` 会更显式。`next_value` 始终保存时间步 `t+1` 的 value。
- `alive = 1.0 - dones[:, t]`：未终止时为 1，允许 bootstrap；终止时为 0，同时截断 TD delta 中的 next value 和 GAE 的未来 advantage。
- `delta = r_t + gamma*V_{t+1}*alive - V_t`：这是一步 TD residual；随后 `last = delta + gamma*lambda*alive*last` 从后向前累积成 GAE。
- `return adv, adv + values`：第一个输出是 advantage `(B,T)`；第二个是 value regression target，也就是 estimated return `(B,T)`。
- `torch.zeros_like`：创建与参照张量完全相同 shape、dtype、device 的全 0 张量；比手写 `torch.zeros(shape)` 更不容易造成 CPU/GPU 或精度不一致。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

#### 输入与输出示例

- **输入/调用**：例如 `rewards=[[1.,1.,1.]]`、`values=[[0.5,0.4,0.2]]`、`dones=[[0.,0.,1.]]`，三者 shape 都是 `(B=1,T=3)`；函数反向递推，返回 `adv.shape=(1,3)` 与 `returns=adv+values`，终止位置不会 bootstrap 到下一状态。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 78. K-Means

**Problem.** Alternate nearest-centroid assignment and centroid recomputation until convergence.

**中文题意。** 使用 `cdist` 批量计算距离；空 cluster 不能产生 NaN，应保留旧中心或重新初始化。

### Reviewed Solution

#### 数学、公式与算法思路

$$
c_k=\frac1{|C_k|}\sum_{x_i\in C_k}x_i,\qquad a_i=\arg\min_k\lVert x_i-c_k\rVert_2^2
$$

- **公式 / 不变量。** K-Means 在分配样本与更新中心之间交替，单调降低簇内平方误差但只保证局部最优。
- **算法拆解。** 初始化 K 个中心，批量算距离并 argmin，按簇求均值更新；空簇需重置或保留旧中心。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def kmeans(x,k,max_iters=100,tol=1e-4):
    if not 1 <= k <= x.size(0): raise ValueError("k 超出范围")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    centers = x[torch.randperm(x.size(0),device=x.device)[:k]].clone()
    # [变化示例] centers=未定义/旧值 -> centers=独立副本；数值相同，但后续原地修改不再共享同一 storage。
    for _ in range(max_iters):
        # [变化示例] 循环示例：range(max_iters) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        labels = torch.cdist(x,centers).argmin(1)
        # [变化示例] labels=未定义/旧值 -> labels 接收 torch.cdist(x,centers).argmin(1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        new = torch.stack([x[labels==i].mean(0) if (labels==i).any()
                           else centers[i] for i in range(k)])
        # [变化示例] new=未定义/旧值 -> new=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
        if (new-centers).norm(dim=1).max() <= tol: break
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        centers = new
        # [变化示例] centers=未定义/旧值 -> centers=new；这是一次重新绑定/状态更新，右侧值决定新状态。
    return centers, labels
    # [变化示例] 函数内部：tuple (centers, labels)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。
```

**中文解释。** v3 解法基本正确。空 cluster 是重要边界条件；初始化质量还可用 k-means++ 改善。

#### 代码/API 逐项解释

- `torch.randperm`：生成 `0..N-1` 的随机排列；K-Means 可用前 k 个随机索引初始化中心。
- `torch.cdist`：计算两组向量的成对距离：`(N,D)` 与 `(M,D)` 得到 `(N,M)` 距离矩阵。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.clone(...)`：`.clone()` 复制数据且保留梯度关系；若想复制并截断梯度通常用 `detach().clone()`。
- `.argmin(...)`：`.argmin(dim)` 返回最小值索引；距离矩阵上使用可选出最近邻/中心。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.norm(...)`：`.norm(dim=...)` 计算范数；embedding normalize 前要用 epsilon 防止零向量除 0。
- `.max(...)`：不传 `dim` 时对全部元素求最大值并返回 0 维标量；传 `dim` 时返回 `(values, indices)`。这里 `(new-centers).norm(dim=1).max()` 对所有 cluster 的中心移动距离取单个最大值，用它与 `tol` 比较收敛。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.any(...)`：`.any()` 判断是否至少有一个 True；空 cluster 检查可用它决定重算还是保留旧中心。

#### 输入与输出示例

- **输入/调用**：输入点 `x.shape=(100,2)`、k=3；`cdist` 得 `(100,3)`，argmin 得 100 个 cluster id，更新中心后输出 centers `(3,2)` 与 labels `(100,)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 79. K-Nearest Neighbors

**Problem.** Classify batched queries by majority label among the k nearest training samples.

**中文题意。** 批量计算 test/train 欧氏距离，取最小 k 个下标，并对对应 labels 投票。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\hat y(x)=\operatorname{mode}\{y_i:i\in\operatorname{KNN}(x)\}
$$

- **公式 / 不变量。** KNN 没有参数训练，预测时按距离找最近 K 个样本并投票或平均。
- **算法拆解。** 广播计算 query 到训练集的距离，top-k 取最小值索引，再聚合标签；预测成本 O(ND)，需考虑特征尺度。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def knn_predict(x_train,y_train,x_test,k=3):
    if not 1 <= k <= x_train.size(0): raise ValueError("k 超出范围")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    ids = torch.cdist(x_test,x_train).topk(k,largest=False).indices
    # [变化示例] ids=未定义/旧值 -> ids 接收 torch.cdist(x_test,x_train).topk(k,largest=False).indices 的返回值；用 shape/dtype/device 与示例输入核对变化。
    # (Ntest,k) -> 每行众数
    return y_train[ids].mode(dim=1).values
    # [变化示例] 函数内部：索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,) -> 调用方收到该输出。
```

**中文解释。** v3 答案正确。`torch.mode` 平票时有固定但可能不符合业务需求的规则；可改用距离加权投票。

#### 代码/API 逐项解释

- `torch.cdist`：计算两组向量的成对距离：`(N,D)` 与 `(M,D)` 得到 `(N,M)` 距离矩阵。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。

#### 输入与输出示例

- **输入/调用**：训练集 `(100,4)`、测试集 `(10,4)`；距离矩阵 `(10,100)`，每行选 k 个邻居投票，输出 10 个预测类别。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 80. Manual Logistic Regression

**Problem.** Train binary logistic regression with analytical BCE gradients and no autograd.

**中文题意。** 手工计算 sigmoid、稳定 BCE、`dw/db`，并在 `no_grad` 语义下更新参数。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p(y=1|x)=\sigma(x^\top w+b),\qquad \mathcal{L}=-y\log p-(1-y)\log(1-p)
$$

- **公式 / 不变量。** 逻辑回归是线性 decision boundary 加 sigmoid；稳定训练应直接使用 logits 形式的 BCE。
- **算法拆解。** 算 logits 和概率/损失，反向更新 w/b；分类阈值默认 0.5 等价于 logit 0，但可按业务调整。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def train_logistic(X,y,lr=.1,steps=1000):
    w,b = X.new_zeros(X.size(1)), X.new_zeros(())
    # [变化示例] w,b=未定义/旧值 -> w,b=指定轴长度；例如 shape=(2,3,4)，size(1) -> 3。
    for _ in range(steps):
        # [变化示例] 循环示例：range(steps) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        logits = X@w+b
        # [变化示例] logits=未定义/旧值 -> logits=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        p = torch.sigmoid(logits)
        # [变化示例] p=未定义/旧值 -> p=逐元素 Sigmoid；例如 [-1,0,1] -> 约 [0.269,0.5,0.731]。
        error = p-y
        # [变化示例] error=未定义/旧值 -> error=p-y；数值示例：3 - 2 -> 1。
        # BCE+sigmoid 的解析梯度
        w -= lr*(X.T@error)/X.size(0)
        # [变化示例] w=旧值 -> w=旧值 - (lr*(X.T@error)/X.size(0))；数值示例：3 - 2 -> 1，并写回 w。
        b -= lr*error.mean()
        # [变化示例] b=旧值 -> b=旧值 - (lr*error.mean())；数值示例：3 - 2 -> 1，并写回 b。
    return w,b
    # [变化示例] 函数内部：tuple (w,b)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。
```

**中文解释。** v3 公式正确。计算报告 loss 时优先使用稳定形式 `softplus(logits)-y*logits`，比对概率取 log 更不易溢出。

#### 代码/API 逐项解释

- `torch.sigmoid`：把任意实数压到 `(0,1)`；大正数接近 1、大负数接近 0，可解释为二分类概率或门值。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.sigmoid(...)`：`.sigmoid()` 把每个元素映射到 `(0,1)`；可作为概率或 gate，但极端输入会进入饱和区。

#### 输入与输出示例

- **输入/调用**：`X.shape=(200,5)`、二元标签 `(200,)`；训练得到权重 `(5,)`，`sigmoid(X@w+b)` 输出 `(200,)` 概率。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 81. Stable Softmax Revisited

**Problem.** Implement vectorized, dimension-aware stable softmax.

**中文题意。** 对任意维度减最大值、指数化、归一化，并保持 broadcasting shape。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\log\sum_j e^{x_j}=m+\log\sum_j e^{x_j-m}
$$

- **公式 / 不变量。** 稳定 Softmax 的核心是 log-sum-exp 恒等式，减最大值后既不改变概率又限制指数范围。
- **算法拆解。** 沿指定轴取 m，计算 shifted exponentials 和归一化；检查概率和为 1、极端 logits 输出有限。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def stable_softmax(x,dim=-1):
    shifted = x-x.amax(dim=dim,keepdim=True)
    # [变化示例] shifted=未定义/旧值 -> shifted=输入减去目标维最大值；例如 [1000,1001] -> [-1,0]。
    exp_x = shifted.exp()
    # [变化示例] exp_x=未定义/旧值 -> exp_x=逐元素指数；例如 [0,1] -> [1,2.718]。
    return exp_x/exp_x.sum(dim=dim,keepdim=True)  # 指定维和为 1
    # [变化示例] 函数内部：exp_x/exp_x.sum(dim=dim,keepdim=True)；数值示例：6 / 3 -> 2 -> 调用方收到该输出。
```

**中文解释。** v3 答案正确，与第 02 题一致。若输入含整型，应先转浮点；若整行都是 `-inf`，Softmax 数学上未定义并会产生 NaN。

#### 代码/API 逐项解释

- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- **稳定性主线**：`amax(...,keepdim=True)` 让每行最大值变 0，`.exp()` 后最大元素为 1，再用保留维度的 sum 广播归一化。
- **边界条件**：若一整行都是 `-inf`，`-inf - (-inf)` 会得到 NaN；生产实现需识别全 mask 行。
- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入 `[1000.,1001.,1002.]` 先变为 `[-2,-1,0]` 再 exp；输出约 `[0.0900,0.2447,0.6652]`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 82. FlashAttention-2 Tiling

**Problem.** Compute exact attention in tiles with online softmax and O(N) auxiliary memory.

**中文题意。** 不创建完整 NxN attention matrix；逐块处理 Q/K/V，并维护每行最大值、归一化和与输出累加器。

### Reviewed Solution

#### 数学、公式与算法思路

$$
O_i=\frac{\sum_j e^{s_{ij}-m_i}V_j}{\sum_j e^{s_{ij}-m_i}}
$$

- **公式 / 不变量。** FlashAttention-2 通过分块和 online Softmax 精确计算同一注意力结果，主要减少 HBM 读写而非改变数学。
- **算法拆解。** 外层遍历 Q tiles，内层扫描 KV tiles并更新 m/l/O；反向也分块重算，避免保存 S×S 矩阵。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def tiled_attention(q,k,v,bq=64,bk=64):
    out = v.new_empty(q.size(0),q.size(1),v.size(-1)); scale=q.size(-1)**-0.5
    # [变化示例] out=未定义/旧值 -> out=v.new_empty(q.size(0),q.size(1),v.size(-1)); scale=q.size(-1)**...；数值示例：2 ** 3 -> 8。
    for i in range(0,q.size(1),bq):
        # [变化示例] 循环示例：range(0,q.size(1) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        qi=q[:,i:i+bq]; m=qi.new_full((*qi.shape[:2],1),-torch.inf)
        # [变化示例] qi=未定义/旧值 -> qi=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        l=qi.new_zeros(*qi.shape[:2],1); acc=v.new_zeros(*qi.shape[:2],v.size(-1))
        # [变化示例] l=未定义/旧值 -> l=指定轴长度；例如 shape=(2,3,4)，size(-1) -> 对应维长度。
        for j in range(0,k.size(1),bk):
            # [变化示例] 循环示例：range(0,k.size(1) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            s=(qi@k[:,j:j+bk].transpose(-2,-1))*scale
            # [变化示例] s=未定义/旧值 -> s=(qi@k[:,j:j+bk].transpose(-2,-1))*scale；数值示例：2 * 3 -> 6。
            m_new=torch.maximum(m,s.amax(-1,keepdim=True))
            # [变化示例] m_new=未定义/旧值 -> m_new=逐元素较小/较大值；例如 minimum([2,5],[3,4]) -> [2,4]。
            correction=(m-m_new).exp(); p=(s-m_new).exp()
            # [变化示例] correction=未定义/旧值 -> correction 接收 (m-m_new).exp(); p=(s-m_new).exp() 的返回值；用 shape/dtype/device 与示例输入核对变化。
            # 最大值变化时，旧分子和分母必须一起缩放
            acc=acc*correction+p@v[:,j:j+bk]; l=l*correction+p.sum(-1,keepdim=True); m=m_new
            # [变化示例] acc=未定义/旧值 -> acc=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        out[:,i:i+bq]=acc/l
        # [变化示例] out[:,i:i+bq]=未定义/旧值 -> out[:,i:i+bq]=acc/l；数值示例：6 / 3 -> 2。
    return out
    # [变化示例] 函数内部：out；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** v3 PyTorch 算法正确。题名包含 Triton，但 notebook 主要可靠部分是在线 Softmax 原理；真正 FlashAttention-2 还涉及并行映射、mask、反向 kernel 和数值累加精度。

#### 代码/API 逐项解释

- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `torch.maximum`：逐元素取两张量较大值，并支持 broadcasting；online softmax 用它更新运行最大值。
- `.new_empty(...)`：`.new_empty(shape)` 只分配不初始化；只有随后完整写入时才安全。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.new_full(...)`：`.new_full(shape,value)` 以当前张量为模板创建常数张量，避免设备和精度不匹配。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。
- **原地更新/切片赋值**：它会修改现有存储；优化器状态更新通常放在 `no_grad` 中，而 forward 中应避免覆盖 backward 仍需的值。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：`q,k,v.shape=(1,128,64)`、`bq=bk=64`；每个 query tile 依次扫描两个 KV tile，输出 `(1,128,64)`，辅助状态按 query 行保存。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 83. FSDP Simulation

**Problem.** Simulate parameter sharding, all-gather before compute, and reduce-scatter after backward.

**中文题意。** 每个 rank 静止时只保存权重 shard；计算前拼成完整参数，反向后只保留本 rank 的聚合梯度 shard。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\theta=\operatorname{concat}(\theta^{(1)},\ldots,\theta^{(P)}),\qquad g^{(p)}=\operatorname{reduce\_scatter}(g)
$$

- **公式 / 不变量。** FSDP 把参数、梯度和优化器状态分片到 P 个 rank，只在计算某层时 all-gather 完整参数。
- **算法拆解。** 前向层前 all-gather，层后可释放；反向 reduce-scatter 梯度，每 rank 只更新本地 shard。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def shard_flat(tensor,world_size):
    # 简化前提：元素数可整除；真实 FSDP 会 padding 并记录原 shape
    return tensor.flatten().chunk(world_size)
    # [变化示例] 函数内部：result 重排为 目标 shape；元素数量与顺序保持不变（若布局允许则共享 storage） -> 调用方收到该输出。

def all_gather(shards,shape):
    return torch.cat(shards).view(shape)
    # [变化示例] 函数内部：result 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4) -> 调用方收到该输出。

def reduce_scatter(rank_grads,world_size):
    # 先跨 rank 求和，再分片；训练若要平均梯度还需除 world_size
    reduced=torch.stack(rank_grads).sum(0)
    # [变化示例] reduced=未定义/旧值 -> reduced 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0）。
    return reduced.flatten().chunk(world_size)
    # [变化示例] 函数内部：result 重排为 目标 shape；元素数量与顺序保持不变（若布局允许则共享 storage） -> 调用方收到该输出。
```

**中文解释。** 仓库 FakeDistributed 能说明通信语义，但不是真正多进程 FSDP。生产系统还需参数 flatten/padding、通信 overlap、mixed precision、optimizer state sharding 和 autograd hooks。

#### 代码/API 逐项解释

- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.chunk(...)`：`.chunk(n,dim)` 尽量把某维分成 n 块；该维不能整除时块大小可能不完全相同。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

#### 输入与输出示例

- **输入/调用**：长度 10 的 flat parameter、world_size=3 会分成带 padding 的 3 个 shard；all-gather 恢复原 shape，reduce-scatter 为每个 rank 返回其梯度 shard。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 84. Ring Attention

**Problem.** Rotate K/V blocks around ranks and accumulate exact attention with online softmax.

**中文题意。** 每个设备保留本地 Q，K/V block 沿 ring 传递；每收到一块就更新 Softmax 统计，遍历一圈得到全局 attention。

### Reviewed Solution

#### 数学、公式与算法思路

$$
K=[K^{(0)};\ldots;K^{(P-1)}],\qquad O=\operatorname{OnlineSoftmaxMerge}_{p=0}^{P-1}(QK^{(p)\top},V^{(p)})
$$

- **公式 / 不变量。** Ring Attention 让 KV 分片沿设备环传递，每个 rank 的 Q 依次看到所有 KV 分片并在线合并。
- **算法拆解。** 每轮计算本地 Q 对当前 KV block 的统计量，同时异步传给下一 rank；P 轮后结果等价于全局 attention。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def ring_update(q,k_block,v_block,m,l,acc,scale):
    scores=(q@k_block.transpose(-2,-1))*scale
    # [变化示例] scores=未定义/旧值 -> scores=(q@k_block.transpose(-2,-1))*scale；数值示例：2 * 3 -> 6。
    new_m=torch.maximum(m,scores.amax(-1,keepdim=True))
    # [变化示例] new_m=未定义/旧值 -> new_m=逐元素较小/较大值；例如 minimum([2,5],[3,4]) -> [2,4]。
    old_scale=(m-new_m).exp(); p=(scores-new_m).exp()
    # [变化示例] old_scale=未定义/旧值 -> old_scale 接收 (m-new_m).exp(); p=(scores-new_m).exp() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    # 与 FlashAttention 相同的跨 block 合并公式
    return new_m, l*old_scale+p.sum(-1,keepdim=True), acc*old_scale+p@v_block
    # [变化示例] 函数内部：矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N) -> 调用方收到该输出。

# 每个 rank 重复 world_size 次：计算本地 block -> send/recv 下一块 K/V
# 最后 output = acc / l
```

**中文解释。** v3 模拟算法抓住核心，但真实 ring 需要异步 P2P 通信与计算 overlap。Causal 模式还要根据全局 query/key offset 屏蔽未来 block，而不只是本地三角 mask。

#### 代码/API 逐项解释

- `torch.maximum`：逐元素取两张量较大值，并支持 broadcasting；online softmax 用它更新运行最大值。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：rank 0 持有本地 q block；每轮接收一个 k/v block 更新 `(m,l,acc)`，循环 world_size 次后 `acc/l` 输出本地 query 的完整 attention。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 85. Triton Fused Softmax

**Problem.** Fuse row-wise max, exponentiation, sum, and normalization into one GPU kernel.

**中文题意。** 一个 Triton program 处理一行，使用 next-power-of-two block 和边界 mask，减少全局显存读写。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p_i=\frac{e^{x_i-m}}{\sum_j e^{x_j-m}}
$$

- **公式 / 不变量。** Triton fused softmax 把减最大值、指数、求和、归一化融合进单个 kernel，减少中间张量和显存往返。
- **算法拆解。** 每个 program 处理一行，加载并 mask 到块大小，做两次 reduction 后写回；块大小和 num_warps 影响性能。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
# Triton kernel 的等价数学，用于先验证正确性
def fused_softmax_reference(x):
    row_max=x.amax(-1,keepdim=True)
    # [变化示例] row_max=未定义/旧值 -> row_max=目标维最大值；例如 [-1,3,2] -> 3。
    numerator=torch.exp(x-row_max)
    # [变化示例] numerator=未定义/旧值 -> numerator=逐元素指数；例如 [0,1] -> [1,2.718]。
    return numerator/numerator.sum(-1,keepdim=True)
    # [变化示例] 函数内部：numerator/numerator.sum(-1,keepdim=True)；数值示例：6 / 3 -> 2 -> 调用方收到该输出。

# kernel 图示：load 一行 -> tl.max -> tl.exp -> tl.sum -> tl.store
# 超过列数的 lane 用 mask=False，并以 -inf 填充
```

**中文解释。** v3 notebook 的 PyTorch reference 正确。Triton kernel 是否正确还依赖 GPU 编译与运行验证；本次按要求未运行，因此不能把硬件 kernel 声称为动态验证通过。

#### 代码/API 逐项解释

- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `.amax(...)`：`.amax(dim, keepdim=True)` 取最大值且可保留维度；稳定 softmax 用它做平移常数。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入矩阵 `(1024,4096)`；每个 Triton program 处理一行，输出同 shape，且每行概率和约为 1。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 86. Beam Search with Length Normalization

**Problem.** Maintain top beams, stop completed sequences, and normalize scores by length.

**中文题意。** 每步扩展活跃 beam，EOS 序列不再扩展；使用长度惩罚减少 raw log-prob 对短序列的偏好。

### Reviewed Solution

#### 数学、公式与算法思路

$$
s_{norm}(y)=\frac{\sum_t\log p(y_t|y_{<t})}{\left(\frac{5+|y|}{6}\right)^\alpha}
$$

- **公式 / 不变量。** 长度归一化缓解累计 log-prob 天然偏爱短序列的问题；alpha 控制惩罚强度。
- **算法拆解。** beam 展开与回溯同普通搜索，但排序时使用归一化分数；要区分搜索中的临时分数和最终分数。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def normalized_score(logp,length,alpha=.6):
    # Google NMT 风格长度惩罚；alpha=0 退化为原始分数
    return logp/(((5+length)/6)**alpha)
    # [变化示例] 函数内部：logp/(((5+length)/6)**alpha)；数值示例：6 / 3 -> 2 -> 调用方收到该输出。

# candidates 排序键：normalized_score(total_logp, len(sequence))
# completed 与 active 分开保存，只有活跃 beam 继续调用模型
```

**中文解释。** v3 答案包含 beam 维护和早停，整体正确。严格早停需判断最佳活跃 beam 的理论上界是否仍能超过最佳完成 beam。

#### 代码/API 逐项解释



- `((5+length)/6)**alpha`：长度为 1 时惩罚因子为 1；序列越长分母越大，从而减轻累计负 log-prob 对长序列的天然惩罚。
- **排序对象**：生成过程中要保存 raw cumulative log-prob；只在比较 beam 时计算 normalized score，不能每步反复覆盖原分数。
- **active 与 completed**：未生成 EOS 的 beam 放在 active 中继续扩展；已生成 EOS 的 beam 固定到 completed，不能继续追加 token，否则长度和分数都会被错误改变。

#### 输入与输出示例

- **输入/调用**：两个 beam 的累计 log-prob 都为 -4，长度分别 4 和 8；length normalization 后较长序列不会仅因多乘了概率而被过度惩罚。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 87. Temperature Sampling

**Problem.** Divide logits by positive temperature and sample from the resulting distribution.

**中文题意。** 温度小于 1 时分布更尖锐，大于 1 时更平坦；温度必须严格为正。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p_i(T)=\frac{e^{z_i/T}}{\sum_j e^{z_j/T}}
$$

- **公式 / 不变量。** T<1 让分布更尖锐，T>1 增加随机性；T 趋近 0 时应退化为 argmax 而非直接除零。
- **算法拆解。** 除以 temperature，稳定 Softmax 后 multinomial 采样；先处理非法或极小温度。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def temperature_sample(logits,temperature=1.0):
    if temperature<=0: raise ValueError("temperature 必须大于 0")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    probs=torch.softmax(logits/temperature,dim=-1)
    # [变化示例] probs=未定义/旧值 -> probs=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    # multinomial 只接受 1D/2D；先把任意前导维展平成 batch
    flat=probs.reshape(-1,probs.size(-1))
    # [变化示例] flat=未定义/旧值 -> flat 重排为 -1,probs.size(-1；元素数量与顺序保持不变（若布局允许则共享 storage）。
    return torch.multinomial(flat,1).reshape(probs.shape[:-1])
    # [变化示例] 函数内部：按概率采样的索引；例如 [0.1,0.9] -> 更可能得到索引 1 -> 调用方收到该输出。
```

**中文解释。** v3 答案正确。若想完全贪心，应显式 `argmax`，而不是传接近 0 的 temperature 造成数值极端。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：logits `[2,1,0]`：temperature=1 正常采样；temperature=0.5 分布更尖锐；temperature 趋近 0 时应改用 argmax。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 88. Top-k Sampling

**Problem.** Keep only the k largest logits, renormalize, and sample.

**中文题意。** 每行 vocabulary logits 只保留最高 k 项，其余设为负无穷，再按概率采样。

### Reviewed Solution

#### 数学、公式与算法思路

$$
S_k=\operatorname{indices\ of\ top\ }k\operatorname{\ logits},\qquad p_i'=\frac{e^{z_i}}{\sum_{j\in S_k}e^{z_j}}\mathbf1[i\in S_k]
$$

- **公式 / 不变量。** Top-k 每步只从概率最高的固定 k 个 token 中采样，直接限制长尾候选。
- **算法拆解。** 裁剪 k 到 [1,V]，取 topk logits，在子集上归一化并采样，再映射回原词表索引。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def top_k_sample(logits,k=50,temperature=1.0):
    if temperature<=0: raise ValueError("temperature 必须为正")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    k=min(max(int(k),1),logits.size(-1))
    # [变化示例] k=未定义/旧值 -> k=指定轴长度；例如 shape=(2,3,4)，size(-1) -> 对应维长度。
    values,indices=(logits/temperature).topk(k,dim=-1)
    # [变化示例] values,indices=未定义/旧值 -> values,indices 接收 (logits/temperature).topk(k,dim=-1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    probs=torch.softmax(values,-1)
    # [变化示例] probs=未定义/旧值 -> probs=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    local=torch.multinomial(probs.reshape(-1,k),1).reshape(*probs.shape[:-1],1)
    # [变化示例] local=未定义/旧值 -> local=按概率采样的索引；例如 [0.1,0.9] -> 更可能得到索引 1。
    # 从 top-k 局部下标映射回原 vocabulary id
    return indices.gather(-1,local).squeeze(-1)
    # [变化示例] 函数内部：执行 indices.gather(-1,local).squeeze(-1) 得到结果 -> 调用方收到该输出。
```

**中文解释。** v3 思路正确。直接在 top-k 子集采样比构建完整 `-inf` tensor 更节省操作。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.topk(...)`：`.topk(k)` 返回最大的 k 个 values 和 indices；采样代码要用 indices 回到原词表。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：logits `[4,3,2,1]`、k=2；后两项被设为 `-inf`，softmax 后概率只在前两项非零，输出一个 token index。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 89. Top-p Nucleus Sampling

**Problem.** Keep the smallest high-probability prefix whose cumulative mass reaches p.

**中文题意。** 按概率降序，保留累计概率刚好覆盖 p 的动态候选集合，并保证越过阈值的第一个 token 不被删掉。

### Reviewed Solution

#### 数学、公式与算法思路

$$
S_p=\min\left\{S:\sum_{i\in S}p_i\ge p\right\}
$$

- **公式 / 不变量。** Top-p 的候选数随分布变化：分布尖时集合小，分布平时集合大。
- **算法拆解。** 概率降序排序并求累计和，移除超过阈值的尾部但保留首个越界 token，重归一化后采样。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def top_p_sample(logits,p=.9,temperature=1.0):
    if not 0<p<=1 or temperature<=0: raise ValueError("采样参数无效")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    sorted_logits,ids=(logits/temperature).sort(descending=True)
    # [变化示例] sorted_logits,ids=未定义/旧值 -> sorted_logits,ids=排序后的值与原索引；例如 [3,1,2] 升序 -> values=[1,2,3], ids=[1,2,0]。
    probs=torch.softmax(sorted_logits,-1)
    # [变化示例] probs=未定义/旧值 -> probs=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    remove=probs.cumsum(-1)-probs>p  # 保留 crossing token
    # [变化示例] remove=未定义/旧值 -> remove=probs.cumsum(-1)-probs>p；数值示例：3 - 2 -> 1。
    sorted_logits=sorted_logits.masked_fill(remove,-torch.inf)
    # [变化示例] sorted_logits=未定义/旧值 -> sorted_logits=mask 后张量；例如 values=[1,2]、mask=[False,True]、fill=-inf -> [1,-inf]。
    probs=torch.softmax(sorted_logits,-1)
    # [变化示例] probs=未定义/旧值 -> probs=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
    local=torch.multinomial(probs.reshape(-1,probs.size(-1)),1).reshape(*probs.shape[:-1],1)
    # [变化示例] local=未定义/旧值 -> local=按概率采样的索引；例如 [0.1,0.9] -> 更可能得到索引 1。
    return ids.gather(-1,local).squeeze(-1)
    # [变化示例] 函数内部：执行 ids.gather(-1,local).squeeze(-1) 得到结果 -> 调用方收到该输出。
```

**中文解释。** v3 解法正确。先减去当前 token 概率再比较，等价于把 remove mask 右移一位。

#### 代码/API 逐项解释

- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.sort(...)`：`.sort(descending=True)` 返回排序值和原索引；top-p 需在排序空间累积后再映射回词表。
- `.cumsum(...)`：`.cumsum(dim)` 计算前缀和；nucleus sampling 用累计概率确定最小候选集合。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.squeeze(...)`：`.squeeze(dim)` 只删除长度为 1 的指定轴；不写 dim 可能意外删掉 batch=1。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：排序概率 `[0.6,0.25,0.1,0.05]`、p=0.8；保留前两项（累计 0.85），重归一化后采样并映射回原词表索引。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 90. Continuous Batching Scheduler

**Problem.** Admit new requests into freed slots while active sequences decode one token per iteration.

**中文题意。** 不等待整个静态 batch 完成；序列遇到 EOS 后立即释放 slot，并从等待队列补入新请求。

### Reviewed Solution

#### 数学、公式与算法思路

$$
B_t=\{r:\ r\text{ is active and ready at step }t\}
$$

- **公式 / 不变量。** Continuous Batching 每个解码步动态移除完成请求并加入新请求，提高 GPU 利用率和吞吐。
- **算法拆解。** 维护 waiting/active/finished 队列，按容量准入，批量执行一步，再更新长度、EOS 和 KV cache 索引。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
from collections import deque

class Scheduler:
    def __init__(self,max_batch): self.max_batch=max_batch; self.waiting=deque(); self.active=[]
    # [变化示例] 调用该单行函数时：self.max_batch=未定义/旧值 -> self.max_batch=max_batch; self.waiting=deque(); self.active=[]；这是一次重新绑定/状态更新，右侧值决定新状态。
    def refill(self):
        while self.waiting and len(self.active)<self.max_batch:
            # [变化示例] 循环示例：条件 True -> 再执行一轮；条件 False -> 退出循环。
            self.active.append(self.waiting.popleft())
            # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
    def step(self,decode_one):
        self.refill(); survivors=[]
        # [变化示例] self.refill(); survivors=未定义/旧值 -> self.refill(); survivors=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for req in self.active:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            token=decode_one(req); req.tokens.append(token)
            # [变化示例] token=未定义/旧值 -> token 接收 decode_one(req); req.tokens.append(token) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            # 完成请求不进入 survivors，slot 下一轮被新请求使用
            if token!=req.eos and len(req.tokens)<req.max_tokens: survivors.append(req)
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        self.active=survivors
        # [变化示例] self.active=未定义/旧值 -> self.active=survivors；这是一次重新绑定/状态更新，右侧值决定新状态。
```

**中文解释。** v3 调度概念正确。生产引擎不是逐请求 Python loop，而是将 active requests 合并成一次 batched forward，并维护每请求 KV pages、position 和采样状态。

#### 代码/API 逐项解释



- `waiting=deque()`：等待队列支持 O(1) 左端弹出；`active` 保存当前 decode step 真正组成 batch 的请求。
- `refill()`：只补到 `max_batch`，避免一个请求完成后 GPU slot 长时间空闲。
- `survivors`：每步只保留未 EOS、未达到 max length、未取消的请求；完成请求必须先写回结果再释放 KV cache。
- **状态输出**：scheduler step 的输出不是单个 tensor，而是更新后的 active/waiting 状态及本轮完成请求集合。

#### 输入与输出示例

- **输入/调用**：请求 A 已生成 3 token、请求 B 刚到达；scheduler 可组成同一 decode batch，step 后更新各自长度，完成/EOS 请求移出 active 队列。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 91. Mini Inference Engine

**Problem.** Combine tokenizer, Transformer, KV cache, batching, and sampling into generation APIs.

**中文题意。** 将模型计算与服务状态分离：请求保存 token/cache，engine 负责 prefill、decode、调度和采样。

### Reviewed Solution

#### 数学、公式与算法思路

$$
x_{t+1}\sim\operatorname{Decode}\!\left(f_\theta(x_{\le t},KV_{\le t})\right)
$$

- **公式 / 不变量。** 迷你推理引擎把 tokenizer、prefill、KV cache、逐步 decode、采样和停止条件串成完整状态机。
- **算法拆解。** 先批量 prefill 建 cache，再循环仅输入新 token，采样并更新每个请求状态；处理 EOS、最大长度和设备放置。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class GenerationState:
    def __init__(self,input_ids,layers):
        self.ids=input_ids; self.cache=[None]*layers; self.finished=False
        # [变化示例] self.ids=未定义/旧值 -> self.ids=input_ids; self.cache=[None]*layers; self.finished=False；数值示例：2 * 3 -> 6。

@torch.inference_mode()
def decode_step(model,state):
    # 首次输入完整 prompt；以后只输入最后一个 token
    ids=state.ids if state.cache[0] is None else state.ids[:,-1:]
    # [变化示例] ids=未定义/旧值 -> ids=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
    logits,new_cache=model(ids,past_key_values=state.cache,use_cache=True)
    # [变化示例] logits,new_cache=未定义/旧值 -> logits,new_cache 接收 model(ids,past_key_values=state.cache,use_cache=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    state.cache=new_cache
    # [变化示例] state.cache=未定义/旧值 -> state.cache=new_cache；这是一次重新绑定/状态更新，右侧值决定新状态。
    token=top_p_sample(logits[:,-1],p=.9)
    # [变化示例] token=未定义/旧值 -> token 接收 top_p_sample(logits[:,-1],p=.9) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    state.ids=torch.cat((state.ids,token[:,None]),1)
    # [变化示例] state.ids=未定义/旧值 -> state.ids 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。
    return token
    # [变化示例] 函数内部：token；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

**中文解释。** v3 mini-engine 适合教学，但“production-grade”还需 paged KV cache、动态 batching、并发安全、取消请求、显存预算、流式输出和故障处理。

#### 代码/API 逐项解释

- `torch.inference_mode`：比 `no_grad` 更强的推理模式，还关闭部分版本计数开销；只应用于纯推理路径。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

#### 输入与输出示例

- **输入/调用**：GenerationState 含 token ids `(B,L)` 和 KV cache；decode_step 输入最后 token，输出 next token `(B,1)` 并把 cache 长度从 L 增到 L+1。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 92. KV Cache Validation

**Problem.** Append new K/V and prove token-by-token output matches full causal recomputation.

**中文题意。** 每步只投影新 token 的 K/V，拼入 cache；比较同一层参数下最后 token 输出与完整序列重算。

### Reviewed Solution

#### 数学、公式与算法思路

$$
K_{cache}[:,:,0:t,:]=[K_0,\ldots,K_{t-1}],\qquad \operatorname{shape}=(B,H,T,D_h)
$$

- **公式 / 不变量。** KV cache 正确性不仅是 shape，还包括位置顺序、每层独立存储、dtype/device 和增量结果与全量结果一致。
- **算法拆解。** 逐 token 与 full forward 对比 logits，检查 cache 长度单调增长且旧前缀不变；用容差比较浮点结果。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
class KVCache:
    def __init__(self): self.k=self.v=None
    # [变化示例] 调用该单行函数时：self.k=未定义/旧值 -> 链式赋值 self.k=self.v=None；等号两侧目标最终引用同一给定值。
    def update(self,k,v):
        self.k=k if self.k is None else torch.cat((self.k,k),dim=-2)
        # [变化示例] self.k=未定义/旧值 -> self.k=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
        self.v=v if self.v is None else torch.cat((self.v,v),dim=-2)
        # [变化示例] self.v=未定义/旧值 -> self.v=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
        return self.k,self.v
        # [变化示例] 函数内部：self.k,self.v；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
    def reset(self): self.k=self.v=None
    # [变化示例] 调用该单行函数时：self.k=未定义/旧值 -> 链式赋值 self.k=self.v=None；等号两侧目标最终引用同一给定值。

# 验证必须复用同一 attention module 权重，并比较 full[:, -1] 与 cached token output
```

**中文解释。** v3 核心正确。Cache 的序列维应明确为 `-2`，多层模型需要每层独立 cache；训练时通常不用 cache，因为 concat 图会保留历史激活。

#### 代码/API 逐项解释

- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `dim=-2`：假设 cache layout 为 `(...,sequence,head_dim)`，倒数第二维才是 token 长度；若布局是 `(B,S,H,D)` 则必须改轴。
- `full[:, -1]`：选择所有 batch 的最后一个 token 输出，shape 从 `(B,S,D)` 变为 `(B,D)`；它应与逐 token cached decode 的最后输出比较。

#### 输入与输出示例

- **输入/调用**：同一 attention 权重下，对序列长度 5：full forward 最后 token 输出与 4-token prefill + 1-token cached decode 输出应在容差内一致。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 93. Full Speculative Decoding

**Problem.** Draft K tokens, verify them in one target pass, accept by p/q, and sample from the correction distribution on rejection.

**中文题意。** 草稿模型逐步提议，目标模型并行评分；接受规则必须保存目标分布，不能简单在拒绝后从 target 原分布采样。

### Reviewed Solution

#### 数学、公式与算法思路

$$
p'(x)=\frac{\max(0,p(x)-q(x))}{\sum_v\max(0,p(v)-q(v))}
$$

- **公式 / 不变量。** 完整 speculative decoding 在拒绝草稿 token 时从修正分布采样，抵消提案分布 q 的影响并保持目标分布 p。
- **算法拆解。** 小模型生成 gamma 个 token，大模型一次验证；顺序接受，拒绝时按 p' 采样，全部接受时再从 p 取一个 token。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def accept_or_correct(p,q,token):
    accept=torch.minimum(p[token]/q[token].clamp_min(1e-12),p.new_tensor(1.0))
    # [变化示例] accept=未定义/旧值 -> accept=min(p[token]/q[token],1)；例如 p=0.6,q=0.8 -> 0.75。
    if torch.rand((),device=p.device)<accept: return token,True
    # [变化示例] 分支示例：条件 True -> 立即返回 token,True；False -> 继续执行下一行。
    residual=(p-q).clamp_min(0)
    # [变化示例] residual=未定义/旧值 -> residual=max(左值-右值,0)；例如 [0.7,0.2]-[0.4,0.5] -> [0.3,0]。
    # 理论拒绝事件下 residual 应有正质量；数值边界使用 p 兜底
    dist=residual if residual.sum()>0 else p
    # [变化示例] dist=未定义/旧值 -> dist=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
    return torch.multinomial(dist/dist.sum(),1).item(),False
    # [变化示例] 函数内部：按概率采样的索引；例如 [0.1,0.9] -> 更可能得到索引 1 -> 调用方收到该输出。
```

**中文解释。** v3 目标正确。索引对齐很关键：目标在 prefix+i 位置的 logits 预测第 i 个 draft；全部接受后还应从目标的下一位置额外采样一个 token。

#### 代码/API 逐项解释

- `torch.minimum`：逐元素取较小值；PPO clipping 或接受概率中用于选择保守目标。
- `torch.rand`：从 `[0,1)` 均匀分布创建张量；若参与概率判断，要确认随机张量与概率张量位于同一 device。
- `torch.multinomial`：按每行非负权重抽样索引；输入不必严格和为 1，但每行总和必须大于 0。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.item(...)`：`.item()` 把单元素张量同步取回 Python 标量；GPU 热路径频繁调用会造成同步开销。

- `.new_tensor(...)`：`.new_tensor(data)` 以当前张量为模板创建常量，避免 CPU/GPU 与 dtype 不一致。

#### 输入与输出示例

- **输入/调用**：draft 一次提出 4 个 token；target 并行验证，连续接受前 k 个，首个拒绝位置从校正分布采样，再开始下一轮。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 94. 2D Sinusoidal Position Embeddings

**Problem.** Encode row and column positions independently into two halves of each patch vector.

**中文题意。** embedding 前半表示 row，后半表示 column；每一半再交替使用 sin/cos。

### Reviewed Solution

#### 数学、公式与算法思路

$$
PE(x,y)=[PE_x(x);PE_y(y)]
$$

- **公式 / 不变量。** 二维正弦位置编码把 embedding 维拆给横纵坐标，使每个 patch 同时携带 x/y 的多频位置信息。
- **算法拆解。** 分别生成 H 和 W 的一维 sin/cos 编码，广播成网格后拼接；保证最终维度和 patch embedding 一致。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def positional_2d(height,width,d_model,device=None,dtype=torch.float32):
    if d_model%4: raise ValueError("d_model 必须能被 4 整除")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    half=d_model//2
    # [变化示例] half=未定义/旧值 -> half=d_model//2；数值示例：7 // 3 -> 2。
    freq=torch.exp(torch.arange(0,half,2,device=device,dtype=torch.float32)*
                   (-math.log(10000.)/half))
    # [变化示例] freq=未定义/旧值 -> freq=逐元素指数；例如 [0,1] -> [1,2.718]。
    rows=torch.arange(height,device=device,dtype=torch.float32)[:,None]*freq
    # [变化示例] rows=未定义/旧值 -> rows=torch.arange(height,device=device,dtype=torch.float32)[:,None]*...；数值示例：2 * 3 -> 6。
    cols=torch.arange(width,device=device,dtype=torch.float32)[:,None]*freq
    # [变化示例] cols=未定义/旧值 -> cols=torch.arange(width,device=device,dtype=torch.float32)[:,None]*freq；数值示例：2 * 3 -> 6。
    r=torch.stack((rows.sin(),rows.cos()),-1).flatten(1)
    # [变化示例] r=未定义/旧值 -> r 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0）。
    c=torch.stack((cols.sin(),cols.cos()),-1).flatten(1)
    # [变化示例] c=未定义/旧值 -> c 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0）。
    # 网格展开顺序：(row0,col0..W-1), (row1,...)
    return torch.cat((r[:,None].expand(-1,width,-1),
                      c[None].expand(height,-1,-1)),-1).reshape(height*width,d_model).to(dtype)
    # [变化示例] 函数内部：result 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4) -> 调用方收到该输出。
```

**中文解释。** 题面只说 d_model 为偶数，但每个 half 还需成对 sin/cos，因此最清晰约束是能被 4 整除。v3 公式方向正确。

#### 代码/API 逐项解释

- `torch.float32`：32 位浮点 dtype；用于位置频率或归一化统计可减少 fp16/bf16 的数值误差。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `torch.cat`：沿已有维度拼接，其他维度必须一致；例如两个 `(B,S,D)` 沿序列维拼成 `(B,2S,D)`。
- `.flatten(...)`：`.flatten(start_dim, end_dim)` 合并连续维；例如 `(B,C,H,W)` 从 dim=1 展平成 `(B,C*H*W)`。
- `.expand(...)`：`.expand(...)` 用 stride=0 创建广播视图而不复制；不能把它当成独立存储原地写。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。
- `math.log(x)`：对正的 Python 标量求自然对数并返回 `float`；位置编码中 `-log(10000)/D` 是固定频率尺度，不需要梯度。若输入是 tensor 或需参与 autograd，应使用 tensor `.log()`。
- `.sin(...)`：`.sin()` 逐元素取正弦；位置编码中输入通常是 position 与 inverse frequency 的乘积。
- `.cos(...)`：`.cos()` 逐元素取余弦；与 sin 交错后得到同一位置的多频率表示。

#### 输入与输出示例

- **输入/调用**：height=2,width=3,d_model=8；输出位置表 shape `(6,8)`，每行对应一个 `(y,x)` patch 坐标。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 95. CLIP InfoNCE

**Problem.** Normalize image/text features and compute symmetric contrastive cross-entropy.

**中文题意。** batch 中第 i 张图与第 i 段文本是正样本；相似度矩阵对角线应最大，图到文与文到图损失取平均。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}_{I\to T}=-\frac1B\sum_i\log\frac{e^{s_{ii}/\tau}}{\sum_j e^{s_{ij}/\tau}},\qquad s_{ij}=\frac{u_i^\top v_j}{\lVert u_i\rVert\lVert v_j\rVert}
$$

- **公式 / 不变量。** CLIP 把同 batch 的匹配图文作为正样本，其余配对作为 in-batch negatives，并对两个方向做交叉熵。
- **算法拆解。** 归一化图像/文本向量，算 B×B 相似度除温度，以对角索引作标签，平均 image-to-text 与 text-to-image loss。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def clip_loss(image_features,text_features,logit_scale):
    image=F.normalize(image_features,dim=-1); text=F.normalize(text_features,dim=-1)
    # [变化示例] image=未定义/旧值 -> image 接收 F.normalize(image_features,dim=-1); text=F.normalize(text_f... 的返回值；用 shape/dtype/device 与示例输入核对变化。
    scale=logit_scale.exp().clamp(max=100)  # 学习 log scale，保证温度为正
    # [变化示例] scale=未定义/旧值 -> scale=逐元素指数；例如 [0,1] -> [1,2.718]。
    logits=scale*(image@text.T); labels=torch.arange(logits.size(0),device=logits.device)
    # [变化示例] logits=未定义/旧值 -> logits=scale*(image@text.T); labels=torch.arange(logits.size(0),device...；数值示例：2 * 3 -> 6。
    return (F.cross_entropy(logits,labels)+F.cross_entropy(logits.T,labels))/2
    # [变化示例] 函数内部：(F.cross_entropy(logits,labels)+F.cross_entropy(logits.T,labels...；数值示例：6 / 3 -> 2 -> 调用方收到该输出。
```

**中文解释。** v3 对称 InfoNCE 正确。参数最好存为 `logit_scale=log(1/T)` 而不是直接 temperature，并限制指数上界防止训练爆炸。

#### 代码/API 逐项解释

- `F.normalize`：按指定维做 Lp 归一化；CLIP 常把 embedding 归一化到单位球面，使点积等于 cosine similarity。
- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `F.cross_entropy`：直接接收未归一化 logits 与整数类别标签，内部融合 `log_softmax + NLLLoss`，更稳定也更高效。
- `.clamp(...)`：`.clamp(min,max)` 截断数值范围；常用于概率、方差或梯度的稳定性保护。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- **`.T`**：二维张量时交换行列；高维张量不应靠 `.T` 表达 attention 转置，应明确使用 `transpose(-2,-1)`。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：image/text features 都是 `(B=4,D=512)`；归一化后相乘得 `(4,4)` 相似度矩阵，对角线是正配对，双向 CE 输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 96. DDIM with Classifier-Free Guidance

**Problem.** Perform deterministic DDIM steps and combine conditional/unconditional noise predictions.

**中文题意。** 用较少时间步从噪声跳步生成；CFG 将条件预测沿远离无条件预测的方向放大。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\hat\epsilon=(1+w)\epsilon_\theta(x_t,t,c)-w\epsilon_\theta(x_t,t,\varnothing)
$$

- **公式 / 不变量。** Classifier-Free Guidance 线性外推条件与无条件噪声预测，增强条件一致性但过大 w 会降低多样性。
- **算法拆解。** 同一 x_t 分别做条件/无条件预测并组合，按 DDIM 确定性或带噪更新到 x_{t-1}；eta 控制随机性。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def cfg_eps(model,x,t,label,scale):
    eps_u=model(x,t,None); eps_c=model(x,t,label)
    # [变化示例] eps_u=未定义/旧值 -> eps_u 接收 model(x,t,None); eps_c=model(x,t,label) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    return eps_u+scale*(eps_c-eps_u)
    # [变化示例] 函数内部：eps_u+scale*(eps_c-eps_u)；数值示例：2 + 3 -> 5 -> 调用方收到该输出。

def ddim_step(x,eps,a_t,a_prev):
    # eta=0：给定初始噪声后路径确定
    x0=(x-(1-a_t).sqrt()*eps)/a_t.sqrt()
    # [变化示例] x0=未定义/旧值 -> x0=(x-(1-a_t).sqrt()*eps)/a_t.sqrt()；数值示例：6 / 3 -> 2。
    return a_prev.sqrt()*x0+(1-a_prev).sqrt()*eps
    # [变化示例] 函数内部：a_prev.sqrt()*x0+(1-a_prev).sqrt()*eps；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** v3 eta=0 核心公式正确。模型训练时必须随机丢弃条件，才能学会 unconditional 分支；最后一步 `a_prev` 应按约定设为 1。

#### 代码/API 逐项解释



- `eps_u + scale*(eps_c-eps_u)`：scale=0 得 unconditional，scale=1 得 conditional，scale>1 把预测沿条件方向外推。
- `x0=(x-sqrt(1-a_t)*eps)/sqrt(a_t)`：从当前 noisy sample 与预测噪声反推出干净样本估计。
- **DDIM 输出**：`eta=0` 时不再采样额外随机噪声；固定初始噪声和模型后，每一步 `x_t -> x_{t-1}` 是确定的。
- `.sqrt(...)`：`.sqrt()` 逐元素开平方；方差、扩散系数等理论上非负，但浮点误差下仍应考虑 clamp/epsilon。

#### 输入与输出示例

- **输入/调用**：模型分别预测 conditional/unconditional epsilon `(B,C,H,W)`，CFG 组合后 DDIM step 从 `x_t` 输出同 shape 的 `x_{t-1}`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 97. DDPM

**Problem.** Implement forward noising, noise-prediction training, and stochastic reverse sampling.

**中文题意。** 训练随机时间步的噪声预测器；采样从标准高斯开始，按后验均值逐步去噪并在非最后步加入方差噪声。

### Reviewed Solution

#### 数学、公式与算法思路

$$
x_t=\sqrt{\bar\alpha_t}x_0+\sqrt{1-\bar\alpha_t}\epsilon,\qquad \mathcal{L}=\mathbb{E}\lVert\epsilon-\epsilon_\theta(x_t,t)\rVert^2
$$

- **公式 / 不变量。** DDPM 训练随机时间步的噪声预测器；采样从高斯噪声开始逐步反演扩散过程。
- **算法拆解。** 预计算 beta/alpha 累积量，训练时一次闭式加噪；推理按 t 从 T 到 1 迭代均值并在非最后步加噪声。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def extract(schedule,t,x):
    # 从长度 T 的 schedule 取出每个样本时间步，并扩展为 (B,1,...,1)
    return schedule.to(x.device).gather(0,t).view(t.size(0),*([1]*(x.ndim-1)))
    # [变化示例] 函数内部：result 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32 -> 调用方收到该输出。

def q_sample(x0,t,alpha_bar,noise=None):
    noise=torch.randn_like(x0) if noise is None else noise
    # [变化示例] noise=未定义/旧值 -> noise=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
    a=extract(alpha_bar,t,x0)
    # [变化示例] a=未定义/旧值 -> a 接收 extract(alpha_bar,t,x0) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    return a.sqrt()*x0+(1-a).sqrt()*noise,noise
    # [变化示例] 函数内部：a.sqrt()*x0+(1-a).sqrt()*noise,noise；数值示例：2 + 3 -> 5 -> 调用方收到该输出。

def p_sample(x_t,eps,t,alpha,alpha_bar,beta):
    a,ab,b=extract(alpha,t,x_t),extract(alpha_bar,t,x_t),extract(beta,t,x_t)
    # [变化示例] a,ab,b=未定义/旧值 -> a,ab,b 接收 extract(alpha,t,x_t),extract(alpha_bar,t,x_t),extract(beta,... 的返回值；用 shape/dtype/device 与示例输入核对变化。
    mean=(x_t-b/(1-ab).sqrt()*eps)/a.sqrt()  # epsilon parameterization
    # [变化示例] mean=未定义/旧值 -> mean=(x_t-b/(1-ab).sqrt()*eps)/a.sqrt()；数值示例：6 / 3 -> 2。
    prev_t=(t-1).clamp_min(0)
    # [变化示例] prev_t=未定义/旧值 -> prev_t=max(左值-右值,0)；例如 [0.7,0.2]-[0.4,0.5] -> [0.3,0]。
    ab_prev=extract(alpha_bar,prev_t,x_t)
    # [变化示例] ab_prev=未定义/旧值 -> ab_prev 接收 extract(alpha_bar,prev_t,x_t) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    ab_prev=torch.where((t==0).view(-1,*([1]*(x_t.ndim-1))),
                        torch.ones_like(ab_prev),ab_prev)
    # [变化示例] ab_prev=未定义/旧值 -> ab_prev=按条件逐元素选择；例如 x=[-2,0,3]、条件 x>0 -> [0,0,3]。
    posterior_var=b*(1-ab_prev)/(1-ab)
    # [变化示例] posterior_var=未定义/旧值 -> posterior_var=b*(1-ab_prev)/(1-ab)；数值示例：2 * 3 -> 6。
    noise=torch.randn_like(x_t)
    # [变化示例] noise=未定义/旧值 -> noise 接收 torch.randn_like(x_t) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    nonzero=(t>0).to(x_t.dtype).view(-1,*([1]*(x_t.ndim-1)))
    # [变化示例] nonzero=未定义/旧值 -> nonzero 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    return mean+nonzero*posterior_var.clamp_min(0).sqrt()*noise
    # [变化示例] 函数内部：mean+nonzero*posterior_var.clamp_min(0).sqrt()*noise；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** 前向闭式公式允许直接从 `x0` 采样任意 `xt`，所以训练不必逐步加噪。反向均值来自 `epsilon` 参数化；随机项应使用后验方差 `beta_t*(1-alpha_bar_{t-1})/(1-alpha_bar_t)`，而不是直接使用 beta。`t=0` 时不再加噪。原简写只给均值且没有正确处理 batch 形式的 t；修正版补齐了完整随机采样和 broadcasting。

#### 代码/API 逐项解释

- `torch.randn_like`：按标准正态分布采样，并继承参照张量的 shape、dtype、device，常用于扩散噪声。
- `torch.where`：逐元素条件选择：`torch.where(condition, a, b)` 在条件为 True 的位置取 `a`，否则取 `b`；三者需满足 broadcasting 规则。
- `torch.ones_like`：创建与参照张量相同 shape、dtype、device 的全 1 张量，常用于标签、mask 或默认乘法因子。
- `.to(...)`：`.to(device_or_dtype)` 迁移设备或转换 dtype；若属性没有接住返回值，原张量不会被原地改变。
- `.gather(...)`：`.gather(dim,index)` 按索引从指定轴取值；index shape 决定输出 shape。
- `.view(...)`：`.view(...)` 在不复制数据时重解释 shape，但要求内存布局兼容；transpose 后通常先 contiguous。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。

- `.sqrt(...)`：`.sqrt()` 逐元素开平方；方差、扩散系数等理论上非负，但浮点误差下仍应考虑 clamp/epsilon。

#### 输入与输出示例

- **输入/调用**：输入干净图 `x0:(B,C,H,W)` 和时间步 `t:(B,)`；q_sample 输出同 shape 噪声图，p_sample 再预测前一时间步样本。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 98. Knowledge Distillation

**Problem.** Combine hard-label CE and temperature-softened teacher/student KL.

**中文题意。** Student 同时学习真实标签和 teacher 的软类别关系；teacher 必须冻结，KL 输入方向要正确。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}=\alpha\mathcal{L}_{hard}+(1-\alpha)T^2D_{KL}(\operatorname{softmax}(z_s/T)\Vert\operatorname{softmax}(z_t/T))
$$

- **公式 / 不变量。** 知识蒸馏同时学习真实标签和教师的软类别关系；T^2 补偿温度导致的梯度缩放。
- **算法拆解。** 教师 eval/no_grad 产生 logits，学生算 hard loss 与温度 soft loss，加权后只更新学生。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def distillation_loss(student,teacher,labels,T=4.,alpha=.7):
    # 软目标传递类别关系，硬目标保证真实标签监督
    soft=F.kl_div(F.log_softmax(student/T,-1),
                  F.softmax(teacher.detach()/T,-1),reduction="batchmean")*(T*T)
    # [变化示例] soft=未定义/旧值 -> soft=F.kl_div(F.log_softmax(student/T,-1), F.softmax(teacher.detach(...；数值示例：2 * 3 -> 6。
    hard=F.cross_entropy(student,labels)
    # [变化示例] hard=未定义/旧值 -> hard=分类损失/损失模块；例如 logits (B,C) 与 labels (B,) -> 标量平均 loss。
    return alpha*soft+(1-alpha)*hard
    # [变化示例] 函数内部：alpha*soft+(1-alpha)*hard；数值示例：2 + 3 -> 5 -> 调用方收到该输出。
```

**中文解释。** v3 答案正确。`F.kl_div` 第一个参数必须是 student log-prob，第二个是 teacher probability；`T^2` 补偿梯度缩放。

#### 代码/API 逐项解释

- `F.kl_div`：计算 KL 相关目标时，默认要求第一个参数是 log-prob；`log_target` 决定 target 是否也已取 log。
- `F.log_softmax`：稳定地同时完成 softmax 和 log；NLL、DPO、蒸馏等需要 log-prob 时应优先使用。
- `F.softmax`：`torch.softmax` 的 functional 形式；必须明确 `dim`，否则无法判断概率在哪个轴归一化。
- `F.cross_entropy`：直接接收未归一化 logits 与整数类别标签，内部融合 `log_softmax + NLLLoss`，更稳定也更高效。
- `.detach(...)`：`.detach()` 返回共享存储但不再追踪当前计算图的张量；用于 target/reference，不能误用在需要梯度的路径。

- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：student/teacher logits `(B,K)`、labels `(B,)`；温度 T 的 KL 与普通 CE 加权后输出标量，KL 项乘 `T^2` 保持梯度尺度。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 99. Mamba Selective Scan

**Problem.** Implement input-dependent state-space parameters and linear-time recurrence.

**中文题意。** 每个 token 产生 delta/B/C，离散化稳定的负 A，然后扫描更新 hidden state 和输出。

### Reviewed Solution

#### 数学、公式与算法思路

$$
h_t=\bar A_t\odot h_{t-1}+\bar B_t\odot x_t,\qquad y_t=C_t\odot h_t+D\odot x_t
$$

- **公式 / 不变量。** Mamba selective scan 让离散状态空间参数依赖当前输入，从而选择性保留或遗忘信息。
- **算法拆解。** 由 x 投影得到 delta/B/C，离散化 A/B，沿序列递推 state 并生成 y；并行 scan 可替代 Python 循环。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def selective_scan(x,delta,A,B,C,D):
    # x:(B,L,D)，A:(D,N)，B/C:(B,L,N)，以下为教学版广播
    h=x.new_zeros(x.size(0),x.size(2),A.size(1)); ys=[]
    # [变化示例] h=未定义/旧值 -> h=指定轴长度；例如 shape=(2,3,4)，size(0) -> 对应维长度。
    for t in range(x.size(1)):
        # [变化示例] 循环示例：range(x.size(1) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        dt=F.softplus(delta[:,t])[:, :, None]
        # [变化示例] dt=未定义/旧值 -> dt 接收 F.softplus(delta[:,t])[:, :, None] 的返回值；用 shape/dtype/device 与示例输入核对变化。
        Abar=torch.exp(dt*A[None])
        # [变化示例] Abar=未定义/旧值 -> Abar=逐元素指数；例如 [0,1] -> [1,2.718]。
        Bbar=dt*B[:,t,None,:]
        # [变化示例] Bbar=未定义/旧值 -> Bbar=dt*B[:,t,None,:]；数值示例：2 * 3 -> 6。
        h=Abar*h+Bbar*x[:,t,:,None]
        # [变化示例] h=未定义/旧值 -> h=Abar*h+Bbar*x[:,t,:,None]；数值示例：2 + 3 -> 5。
        ys.append((h*C[:,t,None,:]).sum(-1)+D*x[:,t])
        # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
    return torch.stack(ys,1)
    # [变化示例] 函数内部：result 在新轴堆叠；例如两个 (B,D) -> (2,B,D)（dim=0） -> 调用方收到该输出。
```

**中文解释。** v3 是 Mamba 思想的简化教学版，不是官方 selective-scan kernel。真实 Mamba 的 B/C 维度、并行 scan、卷积路径、门控和 discretization 更复杂；A 应参数化为负值保证稳定。

#### 代码/API 逐项解释

- `F.softplus`：平滑的正值函数 `log(1+exp(x))`；Mamba 用它确保离散步长 delta 为正。
- `torch.exp`：逐元素指数；logits 很大时可能溢出，所以 softmax 前通常先减最大值。
- `torch.stack`：创建一个新维度后堆叠 shape 相同的张量；与 `cat` 不同，输出 rank 会增加 1。
- `.new_zeros(...)`：`.new_zeros(shape)` 以当前张量为模板创建同 dtype/device 的 0 张量。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `.exp(...)`：`.exp()` 逐元素计算指数；softmax/概率比中必须先做减最大值或 log-space 处理，避免 overflow。

#### 输入与输出示例

- **输入/调用**：输入 `x:(B,L,D)`，scan 按 L 递推状态 `h`；每步用输入相关 delta/B/C 更新，stack 后输出 `(B,L,Dout)`。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 100. MoE with Load Balancing

**Problem.** Route each token to top-k experts and compute an auxiliary balancing loss.

**中文题意。** Router 选择 experts，top-k gate 在局部归一化；辅助损失同时考虑实际路由比例与平均 gate probability。

### Reviewed Solution

#### 数学、公式与算法思路

$$
\mathcal{L}_{bal}=E\sum_{e=1}^{E}f_e\,p_e
$$

- **公式 / 不变量。** MoE 负载均衡损失同时关注实际分配比例 f_e 与平均路由概率 p_e，惩罚 token 集中到少数专家。
- **算法拆解。** router 得概率与 top-k，统计每个专家流量，计算辅助损失，再分发执行专家并加权合并。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def moe_balance(router_probs,top_ids,num_experts):
    # fraction: 实际被选择的 token 比例；prob: router 软概率均值
    one_hot=F.one_hot(top_ids,num_experts).float().sum(1)
    # [变化示例] one_hot=未定义/旧值 -> one_hot 接收 F.one_hot(top_ids,num_experts).float().sum(1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    fraction=one_hot.mean(0)/top_ids.size(1)
    # [变化示例] fraction=未定义/旧值 -> fraction=one_hot.mean(0)/top_ids.size(1)；数值示例：6 / 3 -> 2。
    mean_prob=router_probs.mean(0)
    # [变化示例] mean_prob=未定义/旧值 -> mean_prob=沿指定维求均值；例如 [1,2,3] -> 2。
    return num_experts*(fraction*mean_prob).sum()
    # [变化示例] 函数内部：num_experts*(fraction*mean_prob).sum()；数值示例：2 * 3 -> 6 -> 调用方收到该输出。

# total_loss = task_loss + aux_weight * moe_balance(...)
```

**中文解释。** v3 top-k dispatch 与辅助损失方向正确。生产 MoE 还必须实现 capacity factor、溢出 token 策略、expert parallel 通信和无 Python 双重循环的 grouped GEMM。

#### 代码/API 逐项解释

- `F.one_hot`：把整数类别索引变成 one-hot；输出最后一维大小为类别数，默认 dtype 是整数。
- `.float(...)`：`.float()` 转为 float32；混合精度中常对统计量临时升精度。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。

#### 输入与输出示例

- **输入/调用**：router probabilities `(N,E)`、top expert ids `(N,K)`；one-hot 统计实际负载，与平均路由概率结合得到标量 balance loss。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 101. Sliding-Window Attention Revisited

**Problem.** Build a band mask and compare local attention with full attention.

**中文题意。** 只允许 `|i-j|<=w` 的位置参与 Softmax，并验证足够大窗口时等价于 full attention。

### Reviewed Solution

#### 数学、公式与算法思路

$$
A_{ij}=0\quad\text{if}\quad j>i\ \text{or}\ i-j\ge w
$$

- **公式 / 不变量。** 因果滑窗只允许当前位置查看最近 w 个 token，将每个 query 的有效 key 数限制为常数级。
- **算法拆解。** 根据位置差构造 causal-local mask，mask 后稳定 Softmax；真正省内存需块稀疏 kernel，稠密 mask 只改变语义。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def sliding_mask(seq_len,window,device=None):
    pos=torch.arange(seq_len,device=device)
    # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(seq_len,device=device)；例如 arange(4) 为 [0,1,2,3]。
    return (pos[:,None]-pos[None,:]).abs()<=window
    # [变化示例] 函数内部：执行 (pos[:,None]-pos[None,:]).abs()<=window 得到结果 -> 调用方收到该输出。

def masked_local_attention(q,k,v,window):
    # 窗口外位置在 Softmax 前设为负无穷，概率因此变成 0
    scores=q@k.transpose(-2,-1)/math.sqrt(q.size(-1))
    # [变化示例] scores=未定义/旧值 -> scores=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
    mask=sliding_mask(q.size(-2),window,q.device)
    # [变化示例] mask=未定义/旧值 -> mask=指定轴长度；例如 shape=(2,3,4)，size(-2) -> 对应维长度。
    return torch.softmax(scores.masked_fill(~mask,-torch.inf),-1)@v
    # [变化示例] 函数内部：先把 scores 归一化为每行和为 1 的权重，再与 V 相乘得到 result；shape (...,Sq,Sk) @ (...,Sk,D) -> (...,Sq,D) -> 调用方收到该输出。
```

**中文解释。** v3 数值实现正确，但仍创建 NxN 分数和 mask，所以实际内存仍是 O(N²)。只有 sparse/block kernel 才真正达到题面所说 O(Nw)。

#### 代码/API 逐项解释

- `torch.arange`：生成等差整数序列，例如 `torch.arange(4) -> [0,1,2,3]`；常用于位置编号、batch 索引和 mask 构造。
- `torch.softmax`：沿指定维度把 logits 归一化为和为 1 的概率；attention 通常沿 key 维，分类通常沿类别维。
- `torch.inf`：正无穷常量；`-torch.inf` 常用于把被 mask 的 logits 在 softmax 后变成 0。
- `.abs(...)`：`.abs()` 逐元素绝对值；Huber loss 用它判断误差落在线性还是二次区间。
- `.transpose(...)`：`.transpose(i,j)` 交换两个轴并通常返回非连续 view；后续 `view` 前往往需要 `.contiguous()`。
- `.size(...)`：`.size(dim)` 读取某一维长度，`.size()` 返回完整 shape；它不复制数据。
- `.masked_fill(...)`：`.masked_fill(mask, value)` 在 mask=True 位置填值并返回新张量；attention 常填 `-inf`。
- **切片/索引**：`:` 表示保留该轴全部元素，整数索引会删除该轴；切片前后都要把 shape 写出来，防止 batch、time、head 轴混淆。

- `math.sqrt(x)`：对 Python 数值 x 求平方根并返回 Python `float`，不会创建 tensor，也不进入 autograd 图。这里的 x 是 head dimension、fan-in 或常数，因此标量结果可安全广播到任意 device 上的张量；若 x 本身需要梯度，则必须改用 tensor `.sqrt()`。
- `.softmax(...)`：`.softmax(dim)` 沿指定轴归一化；输出 shape 不变，并且该轴上的概率和为 1。

#### 输入与输出示例

- **输入/调用**：序列长度 6、causal window=3；位置 4 只允许 key 2,3,4，mask 后 attention 输出与 q 相同 shape。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## 102. Vision Transformer and MAE

**Problem.** Patchify images, encode visible patches, insert mask tokens, and reconstruct masked patches.

**中文题意。** MAE 随机保留少量 patch 给 encoder；decoder 按原顺序恢复 visible/mask tokens，只在 masked patches 上计算重建损失。

### Reviewed Solution

#### 数学、公式与算法思路

$$
Z_0=[x_{cls};X_{patch}W_E]+E_{pos},\qquad \mathcal{L}_{MAE}=\frac1{|M|}\sum_{i\in M}\lVert\hat x_i-x_i\rVert_2^2
$$

- **公式 / 不变量。** ViT 把 patch 当 token 做全局 Transformer；MAE 随机遮挡大部分 patch，只在被遮挡位置计算重建损失。
- **算法拆解。** patchify 并加位置编码，ViT 分类时读 CLS；MAE 只编码可见 token，解码时补 mask token 并重建 masked patches。
- **阅读代码顺序。** 先核对输入输出 shape 与约束，再把代码中的中间张量逐项对应到上式，最后检查数值稳定性、mask / 边界条件以及 autograd 路径。

```python
def mae_loss(pred,target,mask):
    # pred/target:(B,N,patch_dim)，mask:(B,N)，1 表示被遮挡
    per_patch=(pred-target).square().mean(-1)
    # [变化示例] per_patch=未定义/旧值 -> per_patch 接收 (pred-target).square().mean(-1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    return (per_patch*mask).sum()/mask.sum().clamp_min(1)
    # [变化示例] 函数内部：(per_patch*mask).sum()/mask.sum().clamp_min(1)；数值示例：6 / 3 -> 2 -> 调用方收到该输出。

def patchify(x,p):
    b,c,h,w=x.shape
    # [变化示例] b,c,h,w=未定义/旧值 -> b,c,h,w=x.shape；这是一次重新绑定/状态更新，右侧值决定新状态。
    if h%p or w%p: raise ValueError("图像尺寸必须整除 patch size")
    # [变化示例] 分支示例：条件 True -> 抛出异常并停止；False -> 输入通过检查并继续。
    # (B,C,H,W) -> (B,Nh*Nw,C*P*P)
    return x.reshape(b,c,h//p,p,w//p,p).permute(0,2,4,1,3,5).reshape(b,-1,c*p*p)
    # [变化示例] 函数内部：result 重排为 b,c,h//p,p,w//p,p；元素数量与顺序保持不变（若布局允许则共享 storage） -> 调用方收到该输出。
```

**中文解释。** v3 整体架构合理。最容易出错的是 restore indices：decoder 输出必须回到原 patch 顺序；loss 只算 masked patches，否则模型会把容量浪费在复制可见输入。

#### 代码/API 逐项解释

- `.square(...)`：`.square()` 逐元素平方；MSE、方差和 L2 距离常用。
- `.mean(...)`：`.mean(dim, keepdim=...)` 沿指定维求均值；归一化时 `keepdim=True` 便于后续 broadcasting。
- `.sum(...)`：`.sum(dim, keepdim=...)` 沿指定轴求和；axis 选错会得到数值看似合理但语义错误的结果。
- `.clamp_min(...)`：`.clamp_min(eps)` 设置下界，防止除 0、负方差舍入误差或 `log(0)`。
- `.reshape(...)`：`.reshape(...)` 尽量返回 view，必要时自动复制；更宽容，但仍要验证元素总数不变。
- `.permute(...)`：`.permute(...)` 任意重排轴，参数必须覆盖每个维度一次；只改变 stride 视图。

#### 输入与输出示例

- **输入/调用**：图像 `(B,3,224,224)`、patch=16 变成 `(B,196,768)` patches；mask 只选被遮 patch，MAE loss 输出标量。
- **输出检查**：先检查输出 shape，再检查 dtype/device，最后检查数值不变量（如概率和、mask 后概率、loss 是否有限）以及需要梯度的输出是否保留 `grad_fn`。

## TorchLeet 静态审查结论

- 实际找到并配对 61 组 notebook，编号 42-102；加上原有内容后总计 102 题。
- 明确错误或不完整的仓库答案已在讲义中替换，包括 BPE 省略号、MHA/GQA 随机投影与 reshape、量化 LM 的 Softmax+CrossEntropy、3D Dice 方向/shape、custom CNN 未使用自定义层、Learned-SiLU backward、变长 attention mask 等。
- 一些系统题只能在 GPU 或多进程环境动态验证，例如 Triton、FSDP、Ring Attention；这里完成的是按要求进行的静态算法审查，没有执行 notebook。
- Flash/Sliding/Mamba/FSDP/Inference Engine 的教学实现表达核心机制，但不应被误认为生产 kernel 或完整服务框架。

---

# 逐题 PyTorch 面试深挖

回答任何实现题时，建议按四步说：先定义输入输出 shape；再写数学公式和稳定性处理；接着解释 autograd、device、dtype；最后给复杂度、边界条件和生产优化。下面是 102 题对应的口述重点与高频追问。

## A. 基础张量、层与训练（01-22）

**01 ReLU。** 核心是逐元素分段函数，时间 O(N)、额外空间取决于实现。面试要说清 `x=0` 的次梯度约定为 0；不要用 `(x>0).float()`，因为它可能把 fp16/bf16 输入提升为 fp32。追问通常是 dying ReLU、LeakyReLU，以及为什么原地 ReLU 可能破坏 backward 所需值。

**02 Softmax。** 先减 row max 是 log-sum-exp trick 的直接应用；它不改变结果，因为公共指数因子在分子分母抵消。复杂度 O(N)，但要强调归一化维度必须正确。追问包括整行 `-inf` 会产生 NaN、混合精度通常用 fp32 累加，以及 CrossEntropy 为什么不应先显式 Softmax。

**03 Linear。** `nn.Linear` 权重布局是 `(out_features,in_features)`，forward 实际计算 `x @ W.T + b`。参数必须是 `nn.Parameter` 才会出现在 `model.parameters()`、state_dict 和 device 迁移中。追问是参数量 `Din*Dout+Dout`、Kaiming/Xavier 选择，以及大 Linear 如何用 tensor parallel 切分。

**04 LayerNorm。** 对每个样本或 token 的最后 D 维独立统计，因此训练和推理行为一致，也不依赖 batch size。方差用总体估计 `correction=0`。追问常比较 LayerNorm、BatchNorm、RMSNorm：统计维度、是否减均值、是否保存 running state，以及 Transformer 为什么偏爱 LayerNorm/RMSNorm。

**05 Scaled Attention。** 必须能口述 shape 链：`Q(B,Sq,Dk) @ K^T(B,Dk,Sk) -> scores(B,Sq,Sk)`，再乘 `V(B,Sk,Dv)`。缩放 `1/sqrt(Dk)` 让点积方差不随维度线性增长，防止 Softmax 饱和。复杂度是 O(B*Sq*Sk*D)，内存 O(B*Sq*Sk)。

**06 MHA。** 多头不是把模型维度放大 H 倍，而是把 D 分成 H 个 Dh，典型总投影复杂度仍为 O(S*D²)，attention 为 O(S²D)。面试要解释 `.transpose(...).contiguous().view(...)` 的 stride 问题。追问是 head pruning、MHA/MQA/GQA 差异及 mask broadcasting。

**07 BatchNorm。** 训练 forward 用 batch 的 biased variance，更新 `running_var` 却用 unbiased variance；eval 使用 running statistics。Momentum 公式是 `new=(1-m)*old+m*batch`，与优化器 momentum 含义不同。追问是小 batch 不稳定、SyncBatchNorm、BN folding，以及为什么 Transformer 很少用 BN。

**08 RMSNorm。** 公式只除 RMS，不减均值，通常也没有 beta，因此比 LayerNorm 少一次 mean 和一组偏置参数。它控制向量尺度但保留均值信息。追问是 `eps` 放在 sqrt 内外的实现差异、低精度时用 fp32 计算方差，以及 LLaMA 为什么使用 RMSNorm。

**09 Causal Attention。** Mask 必须在 Softmax 前把未来 score 设为 `-inf`。要区分 boolean mask 的语义：不同 API 中 True 可能表示“允许”或“屏蔽”，使用前必须看 contract。追问是矩形 causal mask 在 cached decoding 的对齐方式，以及 padding mask 与 causal mask 如何组合。

**10 GQA。** Q heads 数 Hq，KV heads 数 Hkv，每个 KV head 服务 `Hq/Hkv` 个 query heads。KV cache 从 O(B*S*Hq*Dh) 降到 O(B*S*Hkv*Dh)，质量通常优于单 KV head 的 MQA。追问是为什么不能把 K/V head width 写成 `D/Hkv`：每个 head 的点积宽度必须与 Q 的 Dh 一致。

**11 Sliding Window Attention。** 数学 mask 正确不等于复杂度真的下降：若仍创建 NxN scores，内存和计算仍是 O(N²)。真正 O(Nw) 需要 block-sparse 或专用 kernel。追问是双向窗口与 causal 左窗口区别、边界 token 的有效窗口长度，以及多层窗口如何扩大 receptive field。

**12 Linear Attention。** 通过核映射把 `phi(Q)(phi(K)^T V)` 重结合，避免 S² matrix；复杂度约 O(S*Dk*Dv)。它不是 Softmax attention 的严格等价，因为 Softmax kernel 不容易有限维分解。追问是 denominator 稳定性、causal linear scan，以及为什么线性 attention 有时质量不如标准 attention。

**13 GPT Block。** Pre-Norm 顺序是 `x += Attn(Norm(x)); x += MLP(Norm(x))`，residual stream 提供稳定梯度高速路。面试要指出最小实现还缺 attention/MLP dropout、bias 选择和 KV cache。追问是 Pre-Norm vs Post-Norm、最终 norm 的必要性，以及参数量主要来自 4 个 attention 投影和扩展 MLP。

**14 KV Cache。** Cache 保存每层已经投影并拆头的 K/V，不保存 Q。Prefill 是并行处理 prompt；decode 每步只产生新 Q/K/V，但新 Q 仍需读取全部历史 K/V，所以单步 attention 随上下文线性增长。追问是 cache 内存公式、GQA、paged KV cache、prefix sharing 和 chunked prefill。

**15 SwiGLU。** 两个上投影分别产生 gate 和 content，`SiLU(gate)*up` 后下投影。相比 GELU FFN 参数更多，因此实际模型常调整 hidden size，使总参数预算相近。追问是为什么 B/门控增强条件计算、SiLU 导数，以及 tensor parallel 中 gate/up 常合并成一次矩阵乘法。

**16 CrossEntropy。** `CE = logsumexp(logits)-target_logit`，直接从 logits 计算最稳定。类别索引 target 用 gather；padding 使用 `ignore_index` 或 mask 后按有效 token 数归一化。追问是 label smoothing、class weights、序列 loss shift，以及 reduction 对梯度尺度的影响。

**17 Dropout。** Inverted dropout 训练时乘 Bernoulli mask 再除 keep probability，使期望不变；eval 直接 identity。它只在 training mode 随机，复现实验要管理 RNG。追问是 attention dropout 与 residual dropout、checkpoint 重算时 RNG、一致性，以及为什么现代大模型有时将 dropout 设为 0。

**18 Embedding。** 本质是矩阵行查找，不是 one-hot 矩阵乘法，但数学上等价。重复 token 的梯度累加到同一行；`padding_idx` 可让 padding 行不更新。追问是 sparse gradients、weight tying、位置 embedding 和词表并行。

**19 GELU。** `x*Phi(x)` 是平滑概率门控；负输入不是全清零。精确 erf 与 tanh approximation 数值略有差异，载入 checkpoint 时要匹配原模型配置。追问是 GELU/ReLU/SiLU 的导数、计算成本及 Transformer 激活演进。

**20 Kaiming Init。** 目标是在 ReLU 截断约一半信号后保持方差，normal std 为 `sqrt(2/fan_in)`。Conv 的 fan-in 是 `Cin*kH*kW`，不是只有 Cin。追问是 forward 用 fan_in、backward 用 fan_out，Xavier 适合近线性/tanh，以及 residual 分支的特殊缩放。

**21 Gradient Clipping。** Global norm clipping 把所有梯度拼成一个向量后统一缩放，保持方向不变；value clipping 则逐元素截断并改变方向。AMP 下必须先 `scaler.unscale_(optimizer)` 再 clip。追问是 exploding gradient、分布式训练中何时算 global norm，以及 clip threshold 如何监控选择。

**22 Conv2D。** PyTorch 的“卷积”实际是 cross-correlation，不翻转 kernel。输出尺寸为 `floor((H+2P-dilation*(K-1)-1)/stride+1)`；基础题若没支持 dilation/groups 要主动说明。追问是 `unfold+GEMM`、depthwise/group convolution、感受野和参数共享。

## B. Transformer、优化与对齐（23-41）

**23 Cross-Attention。** Q 来自 decoder，K/V 来自 encoder，因此输出长度跟 Sq，memory 长度是 Skv。通常不做 encoder 方向的 causal mask，但必须做 source padding mask。追问是 encoder-decoder cache：K/V 对整个生成过程固定，可预计算一次。

**24 RoPE。** 每对维度做二维旋转，Q_i 与 K_j 的内积包含位置差 `i-j`，因此自然表达相对位置。实现必须匹配 interleaved 或 half-rotation 的 checkpoint 约定。追问是 cache offset、长上下文 scaling、频率 base 和只旋转部分 head_dim。

**25 Online Softmax。** 处理新 block 时，新最大值 `m'` 变化会让旧指数基准失效，所以旧 denominator 和 numerator 都乘 `exp(m-m')`。这就是 FlashAttention 精确而非近似的关键。追问是 IO-aware、为何少写 HBM 比少 FLOPs 更重要、causal tile 跳过和 fp32 accumulator。

**26 LoRA。** 冻结 W，只学习 `deltaW=(alpha/r)BA`；B 零初始化保证初始函数不变。参数量从 `Dout*Din` 变为 `r*(Din+Dout)`。追问是 target modules、rank/alpha、LoRA dropout、merge、QLoRA，以及为什么第一步 A 梯度可能为 0 但 B 能先启动学习。

**27 ViT Patch。** Patchify 把图像从 `(B,C,H,W)` 变成 `(B,N,C*P²)`，Linear 投影后是 token sequence。`Conv2d(kernel=P,stride=P)` 与 patchify+Linear 等价。追问是 patch size 对 N 和 attention O(N²) 的影响、CLS token 与 mean pooling、2D positional encoding。

**28 MoE。** Router 每 token 选 top-k experts，局部 gate 归一化后加权输出。总参数可很大，但每 token 激活参数只约 k 个 expert。追问是 load balance、capacity factor、token drop、expert parallel all-to-all、router z-loss 和 grouped GEMM。

**29 Adam。** 一阶矩是动量，二阶矩是自适应尺度；bias correction 修复从零初始化导致的早期低估。面试必须区分 Adam 中 L2 regularization 与 AdamW decoupled weight decay。追问是 epsilon 放在 sqrt 内外、AMSGrad、状态内存约为参数的 2 倍及 8-bit optimizer。

**30 Cosine Schedule。** Warmup 处理训练初期不可靠的大梯度/统计，cosine 从 max_lr 平滑下降到 min_lr。要明确 step 是 optimizer step 而非 micro-batch step。追问是 token-based schedule、warmup ratio、restart，以及恢复 checkpoint 时 scheduler state。

**31 Gradient Accumulation。** `loss/n` 后多次 backward 再 step，等价前提是 micro-batch 同样大小、随机层/BN 行为可接受。它降低 activation peak memory，但不会降低总计算。追问是 DDP 的 `no_sync()`、AMP scaler 每个 optimizer step 更新一次、gradient clipping 时机。

**32 Top-k/Top-p。** Temperature 先作用 logits，top-k 固定候选数，top-p 动态保留概率质量。过滤后必须重新归一化并至少保留一个 token。追问是 repetition penalty、min-p、typical sampling、随机种子和 batched multinomial shape。

**33 Beam Search。** Beam score 是 token log-prob 之和；EOS beam 单独保存，未完成 beam 才扩展。Raw score 偏好短序列，所以常加 length penalty。追问是 early stopping 上界、KV cache reorder、diverse beam search，以及为什么开放式生成往往用 sampling 而非 beam。

**34 Speculative Decoding。** Draft 提案分布 q、target 分布 p；接受概率 `min(1,p/q)`，拒绝时从归一化正残差 `(p-q)_+` 采样，才能严格保持 p。追问是全部接受后额外 target token、target logits 对齐、acceptance rate 与 draft/target 速度比。

**35 BPE。** Training 依赖 corpus word frequency，逐轮全局选择最高频 pair；encoding 必须严格按 learned merge rank 应用。追问是 byte-level BPE 避免 OOV、Unicode/空格处理、special tokens，以及 BPE 与 WordPiece/Unigram 的目标差异。

**36 INT8 Linear。** 对称 per-output-channel scale 通常比 per-tensor 精度好；权重量化误差约受 scale/2 控制。教学版反量化后做 fp matmul 不会加速，真实收益依赖 packed weight 和量化 kernel。追问是 weight-only vs dynamic activation、zero point、calibration、GPTQ/AWQ。

**37 DPO。** DPO 优化的是 policy 相对 reference 的 chosen/rejected log-ratio 差。Beta 调节隐式 reward 尺度与 reference 约束强度。追问是 sequence logp sum、长度偏差、reference-free 变体、label smoothing、IPO，以及 preference 数据噪声。

**38 简化 GRPO。** 组内 reward normalization 用同 prompt completions 构造 baseline，不需要 critic；但只有 `-A logpi` 不是完整 GRPO。面试应主动补充 old-policy ratio、clip、reference KL、token mask 和多次 policy update。

**39 PPO Loss。** Ratio 在 log space 计算；正负 advantage 下 `min(unclipped,clipped)` 都选择更保守改善。Old logp 和 advantage 要 detach。追问是 value clipping、entropy、GAE、KL early stop、advantage normalization 和 on-policy 数据复用限制。

**40 Linear Regression。** Closed form 用 `lstsq` 比显式逆稳定；手写梯度验证 MSE 导数；nn.Linear 展示 autograd。追问是 rank deficiency、正则化得到 ridge、特征标准化对 GD 收敛、normal equation O(D³) 与迭代法权衡。

**41 OPD。** Reverse KL `KL(student||teacher)` 是 student 分布期望，较 mode-seeking；多个 teachers 先各算 KL 再加权。Temperature 改变软分布，`T²` 补梯度尺度。追问是 forward/reverse KL 行为、mask denominator、teacher detach 和 on-policy trajectory 的含义。

## C. TorchLeet 核心 PyTorch（42-72）

**42 TorchLeet BPE。** 这题的重点不是记代码，而是发现原 solution 仍有 `...`，以及 `Counter.update(dict)` 会丢掉同一词中重复 pair。面试要讲清训练阶段生成 merge ranks，推理阶段不能重新按文本频率选择 merge。复杂度朴素实现每轮扫描整个 corpus，可用 pair index/heap 优化。

**43 TorchLeet GQA。** 最大陷阱是 K/V projection 的输出维应为 `Hkv*Dh`，不是让 KV head 宽度变为 `D/Hkv`。Q/K 点积要求最后维相同。还要指出 Linear 不能在 forward 中临时创建，否则每次随机初始化、参数不会被 optimizer/state_dict 管理。

**44 Attention from Scratch。** 除 shape 外要解释 mask 的 dtype 与语义，float additive mask 和 boolean allow-mask 不可混用。若一整行全部屏蔽，Softmax 会得到 NaN，生产实现应保证至少一个可见 key 或显式处理空行。GPU 上缩放因子最好用 Python float 或同 device tensor。

**45 TorchLeet MHA。** 面试审查题常故意把 parameter creation 放在函数内部；你应立即指出这是无状态随机函数，不是可训练层。正确实现要继承 Module、注册四个 projections，并支持不同 Sq/Sk。进一步追问是 fused QKV projection 如何减少 kernel launch 与显存读写。

**46 TorchLeet RoPE。** Cache cos/sin 时 cache key 不应只有 seq_len，还要考虑 device、dtype、offset 和可能变化的 base/scaling。训练从 offset 0 开始，增量 decode 从 `past_length` 开始。若 checkpoint 使用 half-split rotation，不能随意换成 even/odd interleaving。

**47 Sinusoidal Position。** 固定位置编码无参数，应 `register_buffer` 才会随 `.to(device)` 和 state_dict 移动。偶数/奇数维的 sin/cos 列数要匹配。追问是为什么不同频率允许模型通过线性组合表达相对位移，以及 learned absolute embedding 的长度外推限制。

**48 SmolLM。** 一道完整模型题要从 token IDs 到 logits 逐层说明：Embedding -> N 个 Pre-Norm decoder blocks -> final RMSNorm -> tied LM head。每个 block 内是 causal RoPE-GQA 和 SwiGLU。面试追问通常要求计算参数量、KV cache 大小、训练 label shift，以及 generation 为什么只读取最后位置 logits。

**49 Custom Activation。** `tanh(x)+x` 有显式 residual，导数是 `sech²(x)+1`，始终大于等于 1，因此不会像 sigmoid 那样在大幅值处梯度完全消失，但可能放大梯度。无参数函数不一定要写成 Module；如果需要嵌入 Sequential，Module 更方便。

**50 Dataset/DataLoader。** Dataset 定义单样本访问，DataLoader 定义 batching、shuffle、workers、pin_memory 和 collate。大数据不应全部一次读入内存，可在 `__getitem__` 延迟读取或使用 IterableDataset。追问是多 worker 随机种子、Windows spawn、persistent_workers 和 variable-length collate。

**51 DNN。** 回归末层保持线性；分类二分类可输出一个 logit 配 BCEWithLogits，多分类输出 C logits 配 CrossEntropy。面试应先确认 input dimension 与 task，再决定 hidden width/depth。追问是过拟合、normalization、dropout、residual 和初始化。

**52 Huber Loss。** 在 `|e|=delta` 处函数值和一阶导数连续，小误差梯度 e，大误差梯度饱和为 `delta*sign(e)`，所以抗离群点。追问是 SmoothL1 与 Huber 的缩放定义差异，以及 delta 应根据 target scale 设置。

**53 nn.Linear Regression。** 训练循环最稳妥顺序是 `zero_grad(set_to_none=True) -> forward -> loss -> backward -> step`。`set_to_none` 可省填零并让 optimizer 区分“无梯度”与“零梯度”。追问是 `.train()`/`.eval()` 对纯 Linear 没影响，但统一写法便于模型扩展。

**54 Save/Load。** 推荐保存 state_dict，而非 pickle 整个 Module；加载时先实例化架构，再 `load_state_dict`。当前 PyTorch 对纯权重推荐 `weights_only=True`，且绝不加载不可信 checkpoint。继续训练还需保存 optimizer、scheduler、scaler、epoch、RNG state。

**55 TensorBoard。** 除 loss 外，应记录 learning rate、gradient norm、parameter histograms、throughput 和 validation metrics。Step 必须单调且语义一致。分布式训练只让 rank 0 写日志，避免重复与文件竞争。

**56 Augmentation。** 随机增强只用于 train；val/test 必须 deterministic。Normalization 参数来自训练集统计，不能用 test 数据估计。追问是增强顺序、label-preserving 假设、MixUp/CutMix、RandAugment，以及增强过强造成 distribution shift。

**57 Autoencoder Anomaly。** 训练数据最好主要是 normal samples；threshold 可在 validation normal/anomaly 上按 ROC、F1 或业务成本选择。像素 MSE 不一定捕捉语义异常，可用 feature/perceptual loss。最关键 correctness 是输入目标范围必须匹配 decoder 最后激活。

**58 Benchmark。** GPU 操作异步，wall-clock 前后要 synchronize 或用 CUDA Events；还要 warmup，避免首次编译、allocator 和 cache 污染。报告 median/quantiles，不只一次时间。训练吞吐应同时报告 samples/s、显存和精度，因为更快但数值错误没有意义。

**59 CIFAR CNN。** 每次 stride/pool 后主动写 shape，避免 Linear 输入维硬编码错误；`AdaptiveAvgPool2d` 可解除固定输入尺寸。分类 head 返回 logits。追问是 BatchNorm 位置、global average pooling、ResNet skip connection 和 receptive field。

**60 AMP。** Autocast 只包 forward 和 loss，不包 backward；GradScaler 只对 fp16 通常必要，bf16 动态范围大，常不需要 scaling。若 clip gradients，先 `scaler.unscale_`。遇到 overflow，scaler 会跳过 optimizer step 并降低 scale。

**61 Quantized LM。** CrossEntropy 接收 unnormalized logits，不能先 Softmax。旧 eager `quantize_dynamic` 仍可解释 LSTM/Linear CPU 动态量化，但当前 PyTorch quantization 发展已迁移到 TorchAO。面试要区分存储压缩、真实 kernel speedup、模型精度与硬件支持。

**62 Manual RNN。** BPTT 会把时间展开成深网络，梯度包含 Wh 的多次连乘，导致消失/爆炸。初始 hidden 用 `x.new_zeros` 保证 device/dtype。追问是 truncated BPTT、stateful inference、packed sequences 和 LSTM 门控为什么改善梯度路径。

**63 Custom Autograd。** Forward 保存 backward 真正需要的最少 tensor；backward 返回值数量必须与 forward 输入数量一致，广播参数梯度要 `sum_to_size`。可用 `torch.autograd.gradcheck` 在 double precision 小输入上验证解析梯度。不要把本可由普通 PyTorch ops 自动求导的函数无必要写成 custom Function。

**64 GAN。** 判别器更新时 fake 要 detach；生成器更新时不能 detach。`BCEWithLogitsLoss` 比 Sigmoid+BCELoss 稳定。追问是 minimax vs non-saturating generator loss、mode collapse、WGAN、gradient penalty，以及训练不平衡时 D/G 更新频率。

**65 Seq2Seq Attention。** Encoder memory 与 decoder query 的 additive score 不应把 source length 固定进 Linear 输出维；应该逐 position 共享打分网络。训练常用 teacher forcing，推理用上一步预测，形成 exposure bias。追问是 source mask、beam search、attention coverage 和 Transformer 替代。

**66 Transformer Encoder。** Padding mask 作用于 keys，避免所有 query 读取 padding；若后续 pooling，也要避免把 padding positions 纳入平均。Pre-Norm 重复调用同一个 norm 三次结果相同但浪费，可缓存 `z=norm(x)`。追问是 attention mask 与 key_padding_mask shape/语义差异。

**67 Grad-CAM。** 梯度对空间维平均得到每个 feature map 的重要性权重，再做加权和与 ReLU。它是局部解释，不证明因果；分辨率受最后卷积 feature map 限制。追问是选择哪层、guided backprop、Grad-CAM++ 和 hook 生命周期/线程安全。

**68 3D Segmentation。** 医疗体数据统一使用 `(B,C,D,H,W)`；mask 必须同布局。Dice coefficient 越大越好，因此 loss 是 `1-Dice` 或负 Dice，不能直接最小化 coefficient。实际任务常组合 BCEWithLogits+Dice，处理 class imbalance 与空 mask。

**69 AlexNet。** 经典结构重点是 5 conv + 3 FC、ReLU、overlapping max pool 和 dropout，而不是现代最佳实践。输入 224/227 的尺寸差会影响最终 6x6。面试追问是 AlexNet 的历史贡献、参数主要集中在 FC、为什么现代网络用 GAP/BatchNorm/residual。

**70 Initialization Experiment。** 比较初始化时必须控制相同数据顺序、optimizer、seed 和训练预算；否则结论不公平。全零权重造成 symmetry，所有同层单元梯度相同。Random std=1 对深网络通常过大；Xavier/Kaiming 根据 fan 自动控制方差。

**71 CNN from Scratch。** 自定义 Conv 输出要用 `x.new_zeros` 保持 dtype/device，循环内 tensor assignment 仍可建立 CopySlices autograd 图，但极慢。更向量化的教学实现是 `unfold + einsum/matmul`。最重要审查点是最终模型必须真的使用自定义层。

**72 Custom LSTM。** 四个 gate 可一次大矩阵乘法后 chunk，避免四次 kernel。初始 h/c 通常为零，不能每次随机。面试要写出 `c_t=f*c_{t-1}+i*g` 与 `h_t=o*tanh(c_t)`，并解释 cell state 的加法路径如何缓解梯度消失。

## D. 对齐、经典算法与 GPU/推理系统（73-102）

**73 Full DPO。** `get_batch_logps` 要 shift logits/labels，并对有效 completion tokens 求和。Prompt token 通常不进入 preference loss。Reference 冻结且可预计算 logps。追问是 chosen/rejected 长度不同造成的 sum 偏差、beta、DPO accuracy/reward margin 监控和 reference model 内存优化。

**74 Gradient Checkpoint。** Checkpoint 只省 activation，不省参数、梯度和 optimizer states；代价是 backward 重算 forward。分段数量影响峰值内存与重算量。生产代码显式传 `use_reentrant=False`；含 Dropout 时需保持 RNG。追问是与 CPU offload、FSDP、FlashAttention 的互补关系。

**75 Full GRPO。** 每个 prompt 必须采样 G 个 completion 后组内标准化 reward。Old policy ratio 防止一次 update 走太远，reference KL 防止长期漂移。追问是 reward hacking、格式/答案多 reward 组合、token-level advantage 广播、group std 为 0 和 importance ratio 的数值范围。

**76 LoRA Merge。** `nn.Linear.weight` 是 `(Dout,Din)`，若 forward 是 `x@A.T@B.T`，merge 就是 `W += scale*(B@A)`。Merge 前后应 eval、同 dtype 输入比较。追问是重复 merge 防护、adapter composition、多 adapter 切换和量化 base weight 上是否可直接 merge。

**77 PPO-RLHF。** GAE 从后向前递推 TD residual，并在 done/EOS 处截断 bootstrap。Policy/value/reference/reward 四类模型角色要讲清。追问是 rollout 与 update 阶段、old logps snapshot、whiten advantages、reward/kl shaping、value clipping 和 minibatch epochs。

**78 K-Means。** Assignment 用 O(NKD) 距离，update 用 cluster mean；非凸目标只保证收敛到局部最优。空 cluster 要保留旧中心或重新采样。追问是 k-means++、多次 restart、标准化特征、GPU memory 中 `cdist(N,K)` 的代价。

**79 KNN。** 训练几乎为存储，推理 O(Ntrain*D) 每 query，内存可按 query chunk。`torch.mode` 平票规则应说明。追问是距离加权、特征归一化、cosine vs Euclidean、curse of dimensionality 和 ANN index。

**80 Logistic Regression。** BCE+sigmoid 对 logits 的导数简化为 `p-y`，所以 `dw=X.T@(p-y)/N`。计算 loss 时用 `softplus(z)-y*z` 更稳定。追问是 decision boundary、L2 regularization 梯度、class imbalance、阈值与 AUC。

**81 Softmax Review。** 除数值稳定外，要知道 Softmax 对所有 logits 加同一常数不变，Jacobian 为 `diag(p)-pp^T`。与 CE 合并后对 logits 梯度是 `p-one_hot(y)`。这是面试中从公式推导到高效 fused kernel 的常见链路。

**82 FlashAttention-2。** 它减少 HBM IO 和中间矩阵存储，但数学结果仍是 exact attention。要能推导 online max/sum 合并，并说明 backward 也通过重算避免保存 NxN probabilities。追问是 tile size、occupancy、causal masking、dropout RNG 和 GQA 支持。

**83 FSDP。** ZeRO-1 shard optimizer state，ZeRO-2 再 shard gradients，ZeRO-3/FSDP 再 shard parameters。Forward 前 all-gather full params，backward 后 reduce-scatter grads。追问是 reshard_after_forward、prefetch、mixed precision、state_dict 类型和为什么通信量/峰值 full parameter 仍需管理。

**84 Ring Attention。** Sequence parallel 把长上下文 K/V 分块到设备，Q 保持本地；K/V 环传一圈并用 online Softmax 合并。总计算未减少，单卡内存下降并引入通信。Causal 场景必须基于全局位置决定某 block 全可见、部分可见或全跳过。

**85 Triton Softmax。** 每个 program 通常负责一行，block size 向上取 2 的幂，越界 lane 用 `-inf`。融合避免 max、exp、sum 的多次 HBM round trip。追问是 row 超过 SRAM/block 限制怎么办、warps 数量、fp32 reduction 和与 `torch.compile` 的基准方法。

**86 Beam Search v3。** 除算法，还要讨论模型调用如何 batch beams、父 beam 选择后如何 reorder KV cache。Length penalty 改变排名而非概率模型本身。追问是 beam_width 对质量/延迟、no-repeat ngram、coverage penalty 和 finished beam early stop。

**87 Temperature。** 温度作用在 logits 而不是已归一化概率上；`T->0` 接近 argmax，`T->infinity` 接近均匀。Multinomial 只接受 1D/2D，因此任意前导维要 flatten 后恢复。追问是 entropy 与 temperature 单调关系及 calibration temperature scaling。

**88 Top-k。** 在 top-k 子 logits 上直接 Softmax/采样，避免创建完整 mask。K 必须 clamp 到 `[1,V]`。追问是 tie、批量不同 k、top-k 与 temperature 顺序，以及 k 太小导致重复和模式退化。

**89 Top-p。** 对 sorted probabilities 做 cumulative sum，remove mask 需右移或减当前概率，确保第一个 crossing token 被保留。P 越小越保守。追问是 batch vectorization、至少保留一个 token，以及 top-k+top-p 组合的过滤顺序。

**90 Continuous Batching。** 核心指标是 throughput 和 time-to-first-token/time-per-output-token 的权衡。Prefill 计算密集，decode 内存带宽密集，混批策略会相互干扰。追问是 admission control、max tokens budget、preemption、chunked prefill、fairness 与 cancellation。

**91 Inference Engine。** 分层讲：model executor、KV memory manager、scheduler、sampler、request lifecycle。Prefill 输入整段，decode 输入一个新 token；每层 cache 独立。追问是 paged attention、tensor parallel、CUDA graphs、speculative decoding、streaming 和 observability。

**92 KV Validation。** 正确性测试必须同一权重、eval mode、dropout 关闭、相同 position IDs，并比较 cached 每步输出与 full causal 输出对应最后 token。若 RoPE offset 或 causal mask 错一位，shape 仍对但数值不对，这是高频 debug 点。

**93 Speculative Full。** 性能收益近似取决于一次 target verification 接受多少 draft tokens。Draft 太弱 acceptance 低，太大又不够快。追问是 tree speculation、多 draft heads、KV rollback、batching 下变长接受数，以及为什么 rejection correction 保证无偏。

**94 2D Position。** D 必须能被 4 整除，才能 row/col 各分一半且每半有 sin/cos pairs。Flatten 顺序必须与 patchify 顺序一致。追问是 absolute 2D、relative bias、RoPE-2D、不同图像分辨率插值。

**95 CLIP InfoNCE。** L2 normalize 后点积就是 cosine；batch 中其他样本充当 negatives。对称 CE 让图找文、文找图都学习。追问是 false negatives、大 batch/all-gather features、learnable logit scale、distributed labels offset 和 retrieval Recall@K。

**96 DDIM+CFG。** DDIM eta=0 在给定初始噪声下确定，可跳过 timesteps；CFG `eps_u+s(eps_c-eps_u)`，scale 过高会饱和或失真。追问是训练时 condition dropout、epsilon/v/x0 parameterization、scheduler timestep mapping 和 negative prompt。

**97 DDPM。** 前向 `q(xt|x0)` 有闭式，高效随机 t 训练；反向是学习高斯均值或噪声。Posterior variance 不是简单 beta。追问是 alpha_bar schedule、cosine beta、为什么预测 noise、ELBO 与 simple MSE、EMA model 和采样步数。

**98 Distillation。** Teacher 用 `eval()`、`no_grad()`；student 同时优化 soft KL 与 hard CE。T 越大概率越平，暴露 dark knowledge。追问是 feature/logit distillation、teacher calibration、alpha/T 调参、同 tokenizer/vocab 对齐和 sequence-level distillation。

**99 Mamba。** 连续 SSM 离散化后做 recurrence，Mamba 的 selectivity 来自 input-dependent delta/B/C。A 参数化为负保证稳定，parallel scan 让训练不必纯 Python 顺序循环。追问是与 attention 的状态大小、长序列复杂度、causal convolution、hardware-aware scan 和 chunking。

**100 MoE Balance。** Auxiliary loss 结合实际 dispatch fraction 与 router mean probability；只看一个不足以阻止 collapse。Top-k 离散选择使路由不可微部分依赖 selected gate 梯度。追问是 Switch top-1、Mixtral top-2、capacity overflow、shared experts 和 expert choice routing。

**101 Sliding Window v3。** Dense band mask 只验证数学，不验证 O(Nw) 资源；面试必须主动指出。多层局部 attention 的 receptive field 线性扩大，也可周期加入 global tokens。追问是 Mistral causal window、dilated window 和 block-sparse layout。

**102 ViT-MAE。** MAE encoder 只处理 visible patches，这是主要计算节省；decoder 接收恢复顺序后的 encoded visible tokens 与 learned mask tokens。Loss 只在 masked patches 上算，常先对每个 patch 像素归一化。追问是 75% 高 mask ratio 为什么可行、CLS 是否参与预训练、fine-tuning 如何丢弃 decoder。

## 面试前最终检查表

1. 每段代码先说 shape，不要直接写矩阵乘法。
2. 每个 loss 说清输入是 logits、log-prob 还是 probability，以及 reduction/mask denominator。
3. 每个 Module 说清哪些是 Parameter、哪些是 buffer、哪些是 runtime state/cache。
4. 每个训练循环说清 train/eval、zero_grad、AMP、clip、step、scheduler 的顺序。
5. 每个加速算法区分“数学正确”“复杂度正确”“真实 kernel/系统能加速”三层结论。
6. 遇到 repository reference solution 不正确时，先指出具体 tensor shape、梯度或 API contract，再给修正版。

## 当前 PyTorch API 参考

- [Automatic Mixed Precision](https://docs.pytorch.org/docs/stable/accelerator/amp.html)：当前训练组合是 `torch.autocast` 与 `torch.amp.GradScaler`。
- [torch.load](https://docs.pytorch.org/docs/stable/generated/torch.load.html)：加载纯 state_dict 时使用 `weights_only=True`，不可信 checkpoint 仍不应加载。
- [Activation Checkpointing](https://docs.pytorch.org/docs/stable/checkpoint.html)：生产代码推荐显式设置 `use_reentrant=False`，并注意重算与 RNG state。
- [BatchNorm1d](https://docs.pytorch.org/docs/stable/generated/torch.nn.BatchNorm1d.html)：训练输出使用 biased variance，running variance 使用 unbiased variance。
- [Scaled Dot-Product Attention](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html)：确认 boolean/additive mask、causal 与 GQA 的当前 API 语义。
- [PyTorch Quantization](https://docs.pytorch.org/docs/stable/quantization.html) 与 [TorchAO](https://docs.pytorch.org/ao/stable/)：现有 eager quantization API 仍可用于理解旧 notebook，但新量化开发正在迁移到 TorchAO。

## 验证边界

本文件已完成逐题数学、shape、autograd、device/dtype、API contract 和代码语法的静态审查。当前本地 Python runtime 没有安装 `torch`，因此没有执行 102 题的 tensor 数值测试；Triton、FSDP、Ring Attention、FlashAttention 等还需要对应 GPU/多进程环境做动态验证。面试学习时应把“静态正确”“数值测试通过”“生产性能验证通过”视为三个不同层级。

<!-- LEARN_PYTORCH_APPENDIX_START -->

# learn-pyTorch 课程源码逐项深挖

> 本附录覆盖 `C:/Users/yjian/Desktop/learn-pyTorch` 中全部 123 个可读源文件。图片、JSON profiler traces、pickle memory profiles、CIFAR 压缩包、许可证和 1.1 MB 字符训练语料只作为配套资产，不直接展开为代码题。

> 阅读顺序：先理解问题与性能/数学不变量，再读原始代码，最后按 API 解释和验证清单检查。标为“错误示例”或“环境相关”的内容用于学习边界，不代表可在任意机器直接运行。

## 103. 训练成本与规模 | 1_plot_cost_time.py

**学习问题。** 如何可视化模型训练成本与时间？

**中文讲解。** 双 y 轴和对数尺度可以同时展示跨多个数量级的费用与天数；图表表达的是给定假设下的估算，不应被误读为固定行业价格。 把模型规模、训练时间和费用放到同一张图中，建立性能工程的成本意识。

**来源文件。** `chapter_01_intro/1_plot_cost_time.py`

#### 数学、性能模型与算法思路

$$
C_{train}\approx N_{GPU}\cdot t_{hours}\cdot price_{GPU/hour}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import os

import matplotlib
matplotlib.use('Agg')
# [变化示例] 执行状态：调用 matplotlib.use('Agg') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.family'] = [ 'sans-serif']
# [变化示例] plt.rcParams['font.family']=未定义/旧值 -> plt.rcParams['font.family']=[ 'sans-serif']；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

models = ["GPT-1.3B", "GPT-2.7B", "GPT-6.7B", "GPT-13B", "GPT-30B", "GPT-70B"]
# [变化示例] models=未定义/旧值 -> models=["GPT-1.3B", "GPT-2.7B", "GPT-6.7B", "GPT-13B", "GPT-30B", ...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
costs = [2000, 6000, 30000, 100000, 450000, 2500000]
# [变化示例] costs=未定义/旧值 -> costs=[2000, 6000, 30000, 100000, 450000, 2500000]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
training_days = [0.14, 0.48, 2.32, 7.43, 35.98, 176.55]
# [变化示例] training_days=未定义/旧值 -> training_days=[0.14, 0.48, 2.32, 7.43, 35.98, 176.55]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
model_indices = np.arange(len(models))
# [变化示例] model_indices=未定义/旧值 -> model_indices 接收 np.arange(len(models)) 的返回值；用 shape/dtype/device 与示例输入核对变化。


# Plotting the bar chart with cost and training time using a more optimized approach with Chinese labels and units for training days
fig, ax1 = plt.subplots(figsize=(12, 6))
# [变化示例] fig, ax1=未定义/旧值 -> fig, ax1 接收 plt.subplots(figsize=(12, 6)) 的返回值；用 shape/dtype/device 与示例输入核对变化。

# Creating the first bar chart for costs
bars1 = ax1.bar(model_indices, costs, width=0.4, label='训练成本 (美元)', color='skyblue', align='center')
# [变化示例] bars1=未定义/旧值 -> bars1 接收 ax1.bar(model_indices, costs, width=0.4, label='训练成本 (美元)',... 的返回值；用 shape/dtype/device 与示例输入核对变化。
ax1.set_xlabel('模型')
# [变化示例] 执行状态：调用 ax1.set_xlabel('模型') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
ax1.set_ylabel('训练成本 (美元)')
# [变化示例] 执行状态：调用 ax1.set_ylabel('训练成本 (美元)') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
ax1.set_yscale('log')
# [变化示例] 执行状态：调用 ax1.set_yscale('log') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
ax1.set_title('GPT系列模型训练成本和时间')
# [变化示例] 执行状态：调用 ax1.set_title('GPT系列模型训练成本和时间') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
ax1.set_xticks(model_indices)
# [变化示例] 执行状态：调用 ax1.set_xticks(model_indices) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
ax1.set_xticklabels(models)
# [变化示例] 执行状态：调用 ax1.set_xticklabels(models) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# Adding text on top of the cost bars with shortened numbers
for bar in bars1:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    height = bar.get_height()
    # [变化示例] height=未定义/旧值 -> height 接收 bar.get_height() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    if height >= 1e6:
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        label = f'${height/1e6:.1f}M'
        # [变化示例] label=未定义/旧值 -> label=f'${height/1e6:.1f}M'；这是一次重新绑定/状态更新，右侧值决定新状态。
    elif height >= 1e3:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        label = f'${height/1e3:.1f}k'
        # [变化示例] label=未定义/旧值 -> label=f'${height/1e3:.1f}k'；这是一次重新绑定/状态更新，右侧值决定新状态。
    else:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        label = f'${height:.0f}'
        # [变化示例] label=未定义/旧值 -> label=f'${height:.0f}'；这是一次重新绑定/状态更新，右侧值决定新状态。
    ax1.text(bar.get_x() + bar.get_width() / 2.0, height, label, ha='center', va='bottom')
    # [变化示例] 执行状态：调用 ax1.text(bar.get_x() + bar.get_width() / 2.0, height, label... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# Creating the second bar chart for training days on the same x-axis
ax2 = ax1.twinx()  # instantiate a second axes that shares the same x-axis
# [变化示例] ax2=未定义/旧值 -> ax2 接收 ax1.twinx() 的返回值；用 shape/dtype/device 与示例输入核对变化。
bars2 = ax2.bar(model_indices + 0.4, training_days, width=0.4, label='训练时间 (天)', color='lightcoral', align='center')
# [变化示例] bars2=未定义/旧值 -> bars2 接收 ax2.bar(model_indices + 0.4, training_days, width=0.4, labe... 的返回值；用 shape/dtype/device 与示例输入核对变化。
ax2.set_yscale('log')
# [变化示例] 执行状态：调用 ax2.set_yscale('log') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
ax2.set_ylabel('训练时间 (天)')
# [变化示例] 执行状态：调用 ax2.set_ylabel('训练时间 (天)') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# Adding text on top of the training days bars with "天" unit
for bar in bars2:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    height = bar.get_height()
    # [变化示例] height=未定义/旧值 -> height 接收 bar.get_height() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    ax2.text(bar.get_x() + bar.get_width() / 2.0, height, f'{height:.2f} 天', ha='center', va='bottom')
    # [变化示例] 执行状态：调用 ax2.text(bar.get_x() + bar.get_width() / 2.0, height, f'{he... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# Adding legends
fig.legend(loc='upper left', bbox_to_anchor=(0.1, 0.9), bbox_transform=ax1.transAxes)
# [变化示例] 执行状态：调用 fig.legend(loc='upper left', bbox_to_anchor=(0.1, 0.9), bbo... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

output_path = os.path.join(os.path.dirname(__file__), 'gpt_training_cost_time.png')
# [变化示例] output_path=未定义/旧值 -> output_path 接收 os.path.join(os.path.dirname(__file__), 'gpt_training_cost_... 的返回值；用 shape/dtype/device 与示例输入核对变化。
plt.savefig(output_path, dpi=300, bbox_inches='tight')
# [变化示例] 执行状态：调用 plt.savefig(output_path, dpi=300, bbox_inches='tight') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
print(f'Plot saved to {output_path}')
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 核对图表输入数组长度、单位和对数坐标，再确认输出文件路径与图例表达一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 104. 张量语义与 Autograd | 1_tensor_creation.py

**学习问题。** 创建张量时为什么要同时关注 dtype、device 和 shape？

**中文讲解。** 这三个属性决定数值精度、算子执行位置和维度语义；跨设备或 dtype 不一致是最常见的运行时错误之一。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/1_tensor_creation.py`

#### 数学、性能模型与算法思路

$$
numel(X)=\prod_k shape_k,\qquad device(X)=device(Y)\ \text{for most binary ops}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

if torch.cuda.is_available():
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    device = torch.device("cuda")
    # [变化示例] device=未定义/旧值 -> device 接收 torch.device("cuda") 的返回值；用 shape/dtype/device 与示例输入核对变化。
else:
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    device = torch.device("cpu")
    # [变化示例] device=未定义/旧值 -> device 接收 torch.device("cpu") 的返回值；用 shape/dtype/device 与示例输入核对变化。

x = torch.rand((3, 2), dtype=torch.float32, device=device)
# [变化示例] x=未定义/旧值 -> x=按 (3, 2) 创建的随机张量；shape 固定，具体值由 RNG 决定。

print(x.dtype)  # torch.float32
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
print(x.device)  # cuda:0 or cpu
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
print(x.shape)  # torch.Size([3, 2])
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 105. 张量语义与 Autograd | 2_torch_indexing.py

**学习问题。** 基础索引、切片、Ellipsis 和 None 如何改变张量？

**中文讲解。** 整数索引删除一个轴，切片保留轴，省略号补齐中间轴，None 插入长度为 1 的新轴。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/2_torch_indexing.py`

#### 数学、性能模型与算法思路

$$
offset=storage\_offset+\sum_{k=1}^{d}i_k\,stride_k
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个10*20的张量, 使用contiguous()确保其连续性
x = torch.arange(200).reshape(10, 20).contiguous()
# [变化示例] x=未定义/旧值 -> x=等差序列 arange(200)；例如 arange(4) 为 [0,1,2,3]。

# 访问单个元素，返回第0行的第0个元素
x[0, 0]  # tensor(0)

# 支持负数索引，返回第0行的最后一个元素
x[0, -1]  # tensor(19)

# 切片索引，单独一个冒号表示选择该维度的所有元素，返回第2行的整行数据
x[2, :]
# [变化示例] 读取示例：原 tensor -> 选出指定位置/切片；基础切片通常共享 storage。
# tensor([40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59])

# 切片索引，返回从索引为1的列开始，到索引为9的列（不包含），每隔3个索引选择一个元素，即第0行的第1、4、7列数据
x[0, 1:9:3]  # tensor([[  1,   4,   7])

# 省略号是一个特殊的索引符号，代表"在这个位置选择所有可能的索引"，返回第1列的所有元素
x[..., 1]
# [变化示例] 读取示例：原 tensor -> 选出指定位置/切片；基础切片通常共享 storage。
# tensor([  1,  21,  41,  61,  81, 101, 121, 141, 161, 181])

# 与 NumPy 类似，None 表示加入一个新的维度，常用于调整张量的形状以满足某些特定操作的需求。
# 这里我们在第二个维度（即行和列之间）插入一个新的维度。
x[:, None, :]  # 返回张量的形状为(10, 1, 20)
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 106. 张量语义与 Autograd | 3_assign_via_basic.py

**学习问题。** 基础索引赋值为什么会修改原张量？

**中文讲解。** 基础索引通常返回共享 storage 的 view；对该 view 或对应切片写入会直接更新底层存储。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/3_assign_via_basic.py`

#### 数学、性能模型与算法思路

$$
numel(X)=\prod_k shape_k,\qquad device(X)=device(Y)\ \text{for most binary ops}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个10*20的张量, 使用contiguous()确保其连续性
x = torch.arange(200).reshape(10, 20).contiguous()
# [变化示例] x=未定义/旧值 -> x=等差序列 arange(200)；例如 arange(4) 为 [0,1,2,3]。
print(x)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# 通过基础索引对x的[0, 0]元素进行赋值
x[0, 0] = -1.0
# [变化示例] 目标切片 x[0, 0]=旧值 -> -1.0；base tensor 对应位置同步被写入。
print(x[0, 0])  # x[0, 0]被更新成-1.0
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 通过切片索引对x[2, :]的所有元素进行赋值
x[2, :] = 10
# [变化示例] 目标切片 x[2, :]=旧值 -> 10；base tensor 对应位置同步被写入。
print(x)  # x的第2行(从0计数）的所有元素被更新成10
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 107. 张量语义与 Autograd | 4_transpose.py

**学习问题。** transpose 为什么通常不复制数据？

**中文讲解。** 转置可以只交换 size 与 stride 来重新解释同一 storage；因此结果常为 non-contiguous view。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/4_transpose.py`

#### 数学、性能模型与算法思路

$$
offset=storage\_offset+\sum_{k=1}^{d}i_k\,stride_k
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个3*4的张量, 使用contiguous()确保其连续性
x = torch.arange(12).reshape(3, 4).contiguous()
# [变化示例] x=未定义/旧值 -> x=等差序列 arange(12)；例如 arange(4) 为 [0,1,2,3]。

print(f"x = {x}\nx.stride = {x.stride()}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# x = tensor([[ 0,  1,  2,  3],
#         [ 4,  5,  6,  7],
#         [ 8,  9, 10, 11]])
# x.stride = (4, 1)

y = torch.as_strided(x, size=(4, 3), stride=(1, 4))
# [变化示例] y=未定义/旧值 -> y 接收 torch.as_strided(x, size=(4, 3), stride=(1, 4)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
print(f"y = {y}\ny.stride = {y.stride()}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# y = tensor([[ 0,  4,  8],
#         [ 1,  5,  9],
#         [ 2,  6, 10],
#         [ 3,  7, 11]])
# y.stride = (1, 4)

# 张量x和y共享同一块底层存储
assert id(x.untyped_storage()) == id(y.untyped_storage())
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- stride/view API：只改变索引到 storage 的映射时不复制数据；as_strided 越界或重叠写入非常危险。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 108. 张量语义与 Autograd | 5_basic_index_view.py

**学习问题。** 如何证明基础索引结果与原张量共享内存？

**中文讲解。** 修改 view 后观察 base 同步变化，或比较 storage/data_ptr，可以验证别名关系。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/5_basic_index_view.py`

#### 数学、性能模型与算法思路

$$
offset=storage\_offset+\sum_{k=1}^{d}i_k\,stride_k
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

a = torch.zeros(3, 3)
# [变化示例] a=未定义/旧值 -> a=全 0 张量；shape 由 3, 3 指定。

# 张量b是张量a的一个视图，共享底层内存
b = a[0]
# [变化示例] b=未定义/旧值 -> b=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
print(b)  # tensor([0., 0., 0.])
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 修改张量b的内容也会影响张量a
b[0] = 1
# [变化示例] 目标切片 b[0]=旧值 -> 1；base tensor 对应位置同步被写入。
print(a)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# tensor([[1., 0., 0.],
#         [0., 0., 0.],
#         [0., 0., 0.]])
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 109. 张量语义与 Autograd | 6_reshape.py

**学习问题。** view/reshape 如何改变形状而不改变元素数？

**中文讲解。** 合法 reshape 必须保持 numel 不变；view 还要求 stride 能表达目标布局，否则需要 contiguous 或 reshape 的复制后备。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/6_reshape.py`

#### 数学、性能模型与算法思路

$$
offset=storage\_offset+\sum_{k=1}^{d}i_k\,stride_k
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

original = torch.rand((2, 12))
# [变化示例] original=未定义/旧值 -> original=按 (2, 12) 创建的随机张量；shape 固定，具体值由 RNG 决定。

reshaped = original.view(2, 3, 4)
# [变化示例] reshaped=未定义/旧值 -> reshaped 重排为 2, 3, 4；元素数量与顺序保持不变（若布局允许则共享 storage）。
print("reshaped shape:", reshaped.shape)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# reshaped shape: torch.Size([2, 3, 4])


flattened = reshaped.view(-1)
# [变化示例] flattened=未定义/旧值 -> flattened 重排为 -1；元素数量与顺序保持不变（若布局允许则共享 storage）。
print("flattened shape:", flattened.shape)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# flattened shape: torch.Size([24])
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 110. 张量语义与 Autograd | 7_basic_op.py

**学习问题。** PyTorch 基本算子如何组成计算图？

**中文讲解。** 逐元素运算、归约、线性代数和索引共同构成 tensor 程序；需要梯度的浮点输入会让可微算子进入 autograd 图。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/7_basic_op.py`

#### 数学、性能模型与算法思路

$$
numel(X)=\prod_k shape_k,\qquad device(X)=device(Y)\ \text{for most binary ops}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

x = torch.ones(4, 4)
# [变化示例] x=未定义/旧值 -> x=全 1 张量；例如 shape=(2,3) 时得到 6 个 1。

# 数学运算
y1 = x + x
# [变化示例] y1=未定义/旧值 -> y1=x + x；数值示例：2 + 3 -> 5。
y2 = x * x
# [变化示例] y2=未定义/旧值 -> y2=x * x；数值示例：2 * 3 -> 6。

# 线性代数运算
y3 = x.sum()
# [变化示例] y3=未定义/旧值 -> y3=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

# 索引
x1 = x[1, 1]
# [变化示例] x1=未定义/旧值 -> x1=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 111. 张量语义与 Autograd | 8_add_op.py

**学习问题。** 函数式、方法式和运算符加法有何关系？

**中文讲解。** x.add(y)、torch.add(x,y) 与 x+y 最终分派到同类 ATen 运算；API 风格不同但数学语义一致。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/8_add_op.py`

#### 数学、性能模型与算法思路

$$
\frac{\partial L}{\partial x}=\frac{\partial L}{\partial y}\frac{\partial y}{\partial x}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

x = torch.ones(4, 4)
# [变化示例] x=未定义/旧值 -> x=全 1 张量；例如 shape=(2,3) 时得到 6 个 1。

# torch命名空间下的加法操作
y1 = x.add(x)
# [变化示例] y1=未定义/旧值 -> y1 接收 x.add(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

# 重载运算符"+"，与x.add(x)等价
y2 = x + x
# [变化示例] y2=未定义/旧值 -> y2=x + x；数值示例：2 + 3 -> 5。

# Tensor类的加法操作
y3 = torch.add(x, x)
# [变化示例] y3=未定义/旧值 -> y3 接收 torch.add(x, x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

assert (y1 == y2).all()
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
assert (y2 == y3).all()
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 112. 张量语义与 Autograd | 9_inplace_add.py

**学习问题。** 原地加法与非原地加法有什么区别？

**中文讲解。** 带下划线的算子复用已有 storage 并更新 version counter；非原地算子创建新结果并重新绑定 Python 变量。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/9_inplace_add.py`

#### 数学、性能模型与算法思路

$$
\frac{\partial L}{\partial x}=\frac{\partial L}{\partial y}\frac{\partial y}{\partial x}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

x = torch.ones((4, 4))
# [变化示例] x=未定义/旧值 -> x=全 1 张量；例如 shape=(2,3) 时得到 6 个 1。

# 原位加法操作
y1 = x.add_(x)
# [变化示例] y1=未定义/旧值 -> y1 接收 x.add_(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
print(y1)  # 张量x所有元素更新为2，张量y1是张量x的一个别名，是同一个张量
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 原位加法操作
x += y1
# [变化示例] x=旧值 -> x=旧值 + (y1)；数值示例：2 + 3 -> 5，并写回 x。
print(x)  # 张量x所有元素更新为4
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 非原位加法操作
x = x + y1
# [变化示例] x=未定义/旧值 -> x=x + y1；数值示例：2 + 3 -> 5。
print(x)  # 张量x所有元素更新为8
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 113. 张量语义与 Autograd | 10_adv_index.py

**学习问题。** 高级索引为什么通常会产生副本？

**中文讲解。** 整数 tensor 或布尔 mask 的读取需要收集不规则位置，结果一般拥有独立 storage；但高级索引赋值会散射写回原张量。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/10_adv_index.py`

#### 数学、性能模型与算法思路

$$
offset=storage\_offset+\sum_{k=1}^{d}i_k\,stride_k
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个10*20的张量, 使用contiguous()确保其连续性
x = torch.arange(200).reshape(10, 20).contiguous()
# [变化示例] x=未定义/旧值 -> x=等差序列 arange(200)；例如 arange(4) 为 [0,1,2,3]。

# 基础索引，读取x的第0行
y_basic_index = x[0]
# [变化示例] y_basic_index=未定义/旧值 -> y_basic_index=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。

# (1) 基于基础索引进行读取的返回张量和x共享底层存储
assert y_basic_index.data_ptr() == x.data_ptr()
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。

# 使用整数张量对x进行高级索引，返回位置在[0, 2], [1, 3], [2, 4]位置的元素
z_adv_index_int = x[torch.tensor([0, 1, 2]), torch.tensor([2, 3, 4])]
# [变化示例] z_adv_index_int=未定义/旧值 -> z_adv_index_int=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
# z_adv_index_int = tensor([ 2, 23, 44])

# 对张量x中的每个元素进行判断，如果元素的值小于10，则对应位置的ind为True，否则为False
ind = x < 10
# [变化示例] ind=未定义/旧值 -> ind=x < 10；这是一次重新绑定/状态更新，右侧值决定新状态。
# 使用布尔张量对x进行高级索引，返回x中所有对应ind位置为True的元素
z_adv_index_bool = x[ind]
# [变化示例] z_adv_index_bool=未定义/旧值 -> z_adv_index_bool=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
# z_adv_index_bool = tensor([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

# (2) 基于高级索引进行读取的返回张量和x的底层存储是分开的
assert z_adv_index_int.data_ptr() != x.data_ptr()
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
assert z_adv_index_bool.data_ptr() != x.data_ptr()
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 114. 张量语义与 Autograd | 11_assign_adv.py

**学习问题。** 布尔 mask 赋值如何工作？

**中文讲解。** 先构造与输入可广播的布尔条件，再把右侧值 scatter 到 True 位置；右侧也必须满足广播规则。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/11_assign_adv.py`

#### 数学、性能模型与算法思路

$$
\frac{\partial L}{\partial x}=\frac{\partial L}{\partial y}\frac{\partial y}{\partial x}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个10*20的张量, 使用contiguous()确保其连续性
x = torch.arange(200).reshape(10, 20).contiguous()
# [变化示例] x=未定义/旧值 -> x=等差序列 arange(200)；例如 arange(4) 为 [0,1,2,3]。

# 对张量x中的每个元素进行判断，如果元素的值小于10，则对应位置的ind为 True，否则为False
ind = x < 10
# [变化示例] ind=未定义/旧值 -> ind=x < 10；这是一次重新绑定/状态更新，右侧值决定新状态。
# 通过高级索引对x的部分元素进行赋值
x[ind] = 1.0
# [变化示例] 目标切片 x[ind]=旧值 -> 1.0；base tensor 对应位置同步被写入。

print(x)  # x的对应位置也被更新成1.0
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 115. 张量语义与 Autograd | 12_matmul.py

**学习问题。** GPU 矩阵乘法的 shape 约束是什么？

**中文讲解。** 左矩阵最后一维必须等于右矩阵倒数第二维；矩阵乘法通常是深度学习中算力占比最高的内核。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/12_matmul.py`

#### 数学、性能模型与算法思路

$$
numel(X)=\prod_k shape_k,\qquad device(X)=device(Y)\ \text{for most binary ops}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

x1 = torch.rand(32, 32, dtype=torch.float32, device="cuda:0")
# [变化示例] x1=未定义/旧值 -> x1=按 32, 32 创建的随机张量；shape 固定，具体值由 RNG 决定。
x2 = torch.rand(32, 32, dtype=torch.float32, device="cuda:0")
# [变化示例] x2=未定义/旧值 -> x2=按 32, 32 创建的随机张量；shape 固定，具体值由 RNG 决定。

y = x1 @ x2
# [变化示例] y=未定义/旧值 -> y=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 116. 张量语义与 Autograd | 13_dynamic_graph.py

**学习问题。** PyTorch 动态图怎样支持 Python 控制流？

**中文讲解。** forward 每次执行时即时构图，因此 if/for 可以由当前 tensor 值决定路径；只有实际执行的可微分支进入本轮图。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/13_dynamic_graph.py`

#### 数学、性能模型与算法思路

$$
numel(X)=\prod_k shape_k,\qquad device(X)=device(Y)\ \text{for most binary ops}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

x = torch.tensor(2)  # 可以尝试不同的值，如 torch.tensor(1.0)
# [变化示例] x=未定义/旧值 -> x=2，并采用显式/推断的 dtype 与 device。

y = x % 2
# [变化示例] y=未定义/旧值 -> y=x % 2；数值示例：7 % 3 -> 1。

if y == 0:
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    z = x * 10
    # [变化示例] z=未定义/旧值 -> z=x * 10；数值示例：2 * 3 -> 6。
else:
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    z = x + 10
    # [变化示例] z=未定义/旧值 -> z=x + 10；数值示例：2 + 3 -> 5。

print(z)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 117. 张量语义与 Autograd | 14_static_graph.py

**学习问题。** 静态图控制流与 PyTorch eager 有何差异？

**中文讲解。** 静态图先声明 placeholder 与条件节点，再在 Session 中执行；此文件用 TensorFlow 1.x 对照 PyTorch 的 define-by-run。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/14_static_graph.py`

#### 数学、性能模型与算法思路

$$
numel(X)=\prod_k shape_k,\qquad device(X)=device(Y)\ \text{for most binary ops}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import tensorflow.compat.v1 as tf

x = tf.placeholder(tf.float32, shape=())
# [变化示例] x=未定义/旧值 -> x 接收 tf.placeholder(tf.float32, shape=()) 的返回值；用 shape/dtype/device 与示例输入核对变化。


def true_fn():
    return tf.multiply(x, 10)
    # [变化示例] 函数内部：执行 tf.multiply(x, 10) 得到结果 -> 调用方收到该输出。


def false_fn():
    return tf.add(x, 10)
    # [变化示例] 函数内部：执行 tf.add(x, 10) 得到结果 -> 调用方收到该输出。


y = x % 2
# [变化示例] y=未定义/旧值 -> y=x % 2；数值示例：7 % 3 -> 1。
z = tf.cond(tf.equal(y, 0), true_fn, false_fn)
# [变化示例] z=未定义/旧值 -> z 接收 tf.cond(tf.equal(y, 0), true_fn, false_fn) 的返回值；用 shape/dtype/device 与示例输入核对变化。

with tf.Session() as sess:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    print(sess.run(z, feed_dict={x: 2}))  # 输出 20 (2 * 10)
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
    print(sess.run(z, feed_dict={x: 1}))  # 输出 11 (1 + 10)
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 依赖 TensorFlow 1.x compatibility API，仅用于概念对照，不属于 PyTorch 运行路径。

## 118. 张量语义与 Autograd | 15_ad.py

**学习问题。** loss.backward 如何计算叶子张量梯度？

**中文讲解。** autograd 从标量 loss 反向遍历图，把每条路径的局部 Jacobian 与上游梯度相乘并累加到叶子张量的 grad。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/15_ad.py`

#### 数学、性能模型与算法思路

$$
\frac{\partial L}{\partial x}=\frac{\partial L}{\partial y}\frac{\partial y}{\partial x}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个需要计算梯度的张量
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
# [变化示例] x=未定义/旧值 -> x=[1.0, 2.0, 3.0]，并采用显式/推断的 dtype 与 device。

# 前向传播：
# 1. 构建并执行前向图
# 2. 构建反向图
t = x * 10
# [变化示例] t=未定义/旧值 -> t=x * 10；数值示例：2 * 3 -> 6。
z = t * t
# [变化示例] z=未定义/旧值 -> z=t * t；数值示例：2 * 3 -> 6。

loss = z.mean()
# [变化示例] loss=未定义/旧值 -> loss=沿指定维求均值；例如 [1,2,3] -> 2。

# 反向传播，计算梯度
loss.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

# 查看x的梯度
print(x.grad)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 119. 张量语义与 Autograd | 16_ad_inplace.py

**学习问题。** 为什么原地修改会破坏反向传播？

**中文讲解。** 若 backward 保存了某个中间值，原地写入会改变其 version；autograd 检测到版本不匹配后会拒绝给出错误梯度。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/16_ad_inplace.py`

#### 数学、性能模型与算法思路

$$
\frac{\partial L}{\partial x}=\frac{\partial L}{\partial y}\frac{\partial y}{\partial x}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

# 创建一个需要计算梯度的张量
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
# [变化示例] x=未定义/旧值 -> x=[1.0, 2.0, 3.0]，并采用显式/推断的 dtype 与 device。

t = x * 10
# [变化示例] t=未定义/旧值 -> t=x * 10；数值示例：2 * 3 -> 6。
z = t * t
# [变化示例] z=未定义/旧值 -> z=t * t；数值示例：2 * 3 -> 6。

# 原位加法破坏了反向计算图需要的中间结果
t.add_(1)
# [变化示例] 原地状态：目标 tensor=旧值 -> 执行 t.add_(1) 后直接覆盖同一 storage。
# 触发报错
#     return Variable._execution_engine.run_backward(  # Calls into the C++ engine to run the backward pass
#           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
# RuntimeError: one of the variables needed for gradient computation has been modified by an inplace operation: [torch.FloatTensor [3]], which is output 0 of AddBackward0, is at version 1; expected version 0 instead. Hint: enable anomaly detection to find the operation that failed to compute its gradient, with torch.autograd.set_detect_anomaly(True).


loss = z.mean()
# [变化示例] loss=未定义/旧值 -> loss=沿指定维求均值；例如 [1,2,3] -> 2。

loss.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

print(x.grad)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 此文件故意触发 autograd version mismatch，用于展示错误，不是可成功训练的实现。

## 120. 张量语义与 Autograd | 17_custom_ad.py

**学习问题。** 如何实现自定义 autograd.Function？

**中文讲解。** forward 保存 backward 真正需要的张量；backward 接收上游梯度并按链式法则返回每个输入的梯度。 理解张量的 shape、stride、storage、索引、原地操作和动态计算图，是排查 PyTorch 正确性问题的基础。

**来源文件。** `chapter_03_pytorch/17_custom_ad.py`

#### 数学、性能模型与算法思路

$$
\frac{\partial L}{\partial x}=\frac{\partial L}{\partial y}\frac{\partial y}{\partial x}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch


class MyMul(torch.autograd.Function):
    @staticmethod
    def forward(ctx, input1, input2):
        ctx.save_for_backward(input1, input2)
        # [变化示例] 执行状态：调用 ctx.save_for_backward(input1, input2) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        return input1 * input1 * input2
        # [变化示例] 函数内部：input1 * input1 * input2；数值示例：2 * 3 -> 6 -> 调用方收到该输出。

    @staticmethod
    def backward(ctx, grad_output):
        input1, input2 = ctx.saved_tensors
        # [变化示例] input1, input2=未定义/旧值 -> input1, input2=ctx.saved_tensors；这是一次重新绑定/状态更新，右侧值决定新状态。
        grad_input1 = grad_output * 2 * input1 * input2
        # [变化示例] grad_input1=未定义/旧值 -> grad_input1=grad_output * 2 * input1 * input2；数值示例：2 * 3 -> 6。
        grad_input2 = grad_output * input1 * input1
        # [变化示例] grad_input2=未定义/旧值 -> grad_input2=grad_output * input1 * input1；数值示例：2 * 3 -> 6。
        return grad_input1, grad_input2
        # [变化示例] 函数内部：tuple (grad_input1, grad_input2)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。


# 使用自定义的乘法操作
x = torch.tensor([2.0, 3.0], requires_grad=True)
# [变化示例] x=未定义/旧值 -> x=[2.0, 3.0]，并采用显式/推断的 dtype 与 device。
y = torch.tensor([3.0, 4.0], requires_grad=True)
# [变化示例] y=未定义/旧值 -> y=[3.0, 4.0]，并采用显式/推断的 dtype 与 device。
z = MyMul.apply(x, y)
# [变化示例] z=未定义/旧值 -> z 接收 MyMul.apply(x, y) 的返回值；用 shape/dtype/device 与示例输入核对变化。
z.backward(torch.tensor([1.0, 1.0]))
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

print(f"x.grad={x.grad}, y.grad={y.grad}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# x.grad=tensor([12., 24.]), y.grad=tensor([4., 9.])
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 验证 shape、stride、contiguous、storage/data_ptr、dtype/device；涉及梯度时再检查 grad_fn、叶子 grad 与有限差分。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 121. 可靠计时与性能分析 | 1_ps.sh

**学习问题。** 如何定位正在运行的训练进程？

**中文讲解。** ps 与过滤命令可定位 PID、CPU 时间和启动参数；原文件中的 ps aus 是拼写问题，常用写法是 ps aux。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/1_ps.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
ps aus | grep <PID>
# [变化示例] 进程表 -> 输出匹配 PID/命令行；本例应使用 ps aux，再用 grep 缩小结果。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 原文件的 ps aus 应改为常见的 ps aux；尖括号 PID 只是占位符。

## 122. 可靠计时与性能分析 | 2_kill.sh

**学习问题。** 如何安全终止异常训练进程？

**中文讲解。** 优先发送 SIGTERM 让程序清理资源；kill -9 是不可捕获的 SIGKILL，只应在进程无法正常退出时使用。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/2_kill.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
kill -9 <PID>
# [变化示例] 目标进程=运行中 -> 收到信号后退出；-9 会强制终止且不执行清理。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** kill -9 会跳过清理逻辑；优先尝试 kill <PID> 或 SIGTERM。

## 123. 可靠计时与性能分析 | 3_seed_pt.py

**学习问题。** torch.manual_seed 能保证什么？

**中文讲解。** 它固定 PyTorch 随机数生成器的起点；完整复现还需要控制 Python、NumPy、CUDA 算法和数据加载顺序。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/3_seed_pt.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch


def generate_random_seq(device):
    return torch.rand((3, 3), device=device)
    # [变化示例] 函数内部：按 (3, 3) 创建的随机张量；shape 固定，具体值由 RNG 决定 -> 调用方收到该输出。


print(
    f"""不设置随机种子时，每次运行生成的序列都是不同的
CPU: {generate_random_seq('cpu')}
CUDA: {generate_random_seq('cuda')}"""
)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 为所有PyTorch后端设置生成随机数的种子
seed = 32
# [变化示例] seed=未定义/旧值 -> seed=32；这是一次重新绑定/状态更新，右侧值决定新状态。
torch.manual_seed(seed)
# [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。

print(
    f"""设置随机种子后，每次运行都会生成相同的序列
CPU: {generate_random_seq('cpu')}
CUDA: {generate_random_seq('cuda')}"""
)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 第一次运行代码结果
# 不设置随机种子时，每次运行生成的序列都是不同的
# CPU: tensor([[0.8485, 0.6379, 0.6855],
#         [0.0954, 0.7357, 0.3545],
#         [0.9822, 0.1272, 0.9752]])
# CUDA: tensor([[0.5688, 0.7038, 0.6558],
#         [0.1524, 0.8050, 0.7368],
#         [0.5904, 0.2899, 0.4835]], device='cuda:0')
# 设置随机种子后，每次运行都会生成相同的序列
# CPU: tensor([[0.8757, 0.2721, 0.4141],
#         [0.7857, 0.1130, 0.5793],
#         [0.6481, 0.0229, 0.5874]])
# CUDA: tensor([[0.6619, 0.2778, 0.7292],
#         [0.8970, 0.0063, 0.7033],
#         [0.9305, 0.2407, 0.3767]], device='cuda:0')

# 相同代码，第二次运行结果
# 不设置随机种子时，每次运行生成的序列都是不同的
# CPU: tensor([[0.3968, 0.4038, 0.7816],
#         [0.1577, 0.8753, 0.8638],
#         [0.3971, 0.2644, 0.1432]])
# CUDA: tensor([[0.4933, 0.2223, 0.5825],
#         [0.6528, 0.9796, 0.3861],
#         [0.7478, 0.2834, 0.7953]], device='cuda:0')
# 设置随机种子后，每次运行都会生成相同的序列
# CPU: tensor([[0.8757, 0.2721, 0.4141],
#         [0.7857, 0.1130, 0.5793],
#         [0.6481, 0.0229, 0.5874]])
# CUDA: tensor([[0.6619, 0.2778, 0.7292],
#         [0.8970, 0.0063, 0.7033],
#         [0.9305, 0.2407, 0.3767]], device='cuda:0')
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 124. 可靠计时与性能分析 | 4_seed_np.py

**学习问题。** 如何固定 NumPy 随机序列？

**中文讲解。** 设置相同 seed 可重放同一伪随机序列，但全局 RNG 会受调用顺序影响；新代码可考虑显式 Generator。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/4_seed_np.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import numpy as np


def generate_random_seq():
    return ", ".join([f"{np.random.random():.2f}" for _ in range(10)])
    # [变化示例] 函数内部：执行 ", ".join([f"{np.random.random():.2f}" for _ in range(10)]) 得到结果 -> 调用方收到该输出。


print(f"不设置随机种子时，每次运行生成的序列都是不同的: {generate_random_seq()}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

np.random.seed(32)
# [变化示例] 执行状态：调用 np.random.seed(32) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

print(f"设置随机种子后，每次运行都会生成相同的序列: {generate_random_seq()}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 第一次运行结果
# 不设置随机种子时，每次运行生成的序列都是不同的: 0.11, 0.98, 0.96, 0.29, 0.80, 0.21, 0.49, 0.36, 0.41, 0.64
# 设置随机种子后，每次运行都会生成相同的序列: 0.86, 0.37, 0.56, 0.96, 0.74, 0.82, 0.10, 0.93, 0.61, 0.60

# 第二次运行结果
# 不设置随机种子时，每次运行生成的序列都是不同的: 0.19, 0.32, 0.09, 0.94, 0.03, 0.04, 0.32, 0.19, 0.10, 0.64
# 设置随机种子后，每次运行都会生成相同的序列: 0.86, 0.37, 0.56, 0.96, 0.74, 0.82, 0.10, 0.93, 0.61, 0.60
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 125. 可靠计时与性能分析 | 5_seed_py.py

**学习问题。** Python random 如何复现？

**中文讲解。** random.seed 固定标准库 RNG；它与 NumPy、PyTorch 的 RNG 状态相互独立。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/5_seed_py.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import os
import random


def generate_random_seq():
    return ", ".join([f"{random.random():.2f}" for _ in range(10)])
    # [变化示例] 函数内部：执行 ", ".join([f"{random.random():.2f}" for _ in range(10)]) 得到结果 -> 调用方收到该输出。


print(f"不设置随机种子时，每次运行生成的序列都是不同的: {generate_random_seq()}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

seed = 32
# [变化示例] seed=未定义/旧值 -> seed=32；这是一次重新绑定/状态更新，右侧值决定新状态。
random.seed(seed)
# [变化示例] 执行状态：调用 random.seed(seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

print(f"设置随机种子后，每次运行都会生成相同的序列: {generate_random_seq()}")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 第一次运行结果
# 不设置随机种子时，每次运行生成的序列都是不同的: 0.66, 0.21, 0.71, 0.37, 0.17, 0.85, 0.29, 0.66, 0.36, 0.68
# 设置随机种子后，每次运行都会生成相同的序列: 0.08, 0.21, 0.30, 0.90, 0.50, 0.72, 0.10, 0.51, 0.84, 0.52

# 第二次运行结果
# 不设置随机种子时，每次运行生成的序列都是不同的: 0.26, 0.33, 0.47, 0.53, 0.13, 0.03, 0.49, 0.99, 0.11, 0.43
# 设置随机种子后，每次运行都会生成相同的序列: 0.08, 0.21, 0.30, 0.90, 0.50, 0.72, 0.10, 0.51, 0.84, 0.52
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 126. 可靠计时与性能分析 | 6_hash.sh

**学习问题。** PYTHONHASHSEED 为什么影响复现？

**中文讲解。** 哈希随机化可能改变依赖 hash 顺序的集合/字典遍历行为；应在启动 Python 进程前设置环境变量。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/6_hash.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
python -c 'print(hash("hello"))' # 跑多次结果是不一样的
# [变化示例] 命令状态：执行 python -c 'print(hash("hello"))' 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
PYTHONHASHSEED=0 python -c 'print(hash("hello"))' #跑多次结果是一样的
# [变化示例] 哈希种子=随机/未固定 -> 新 Python 进程使用指定哈希种子。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 127. 可靠计时与性能分析 | 7_cudnn.py

**学习问题。** cuDNN benchmark 与 deterministic 如何取舍？

**中文讲解。** benchmark 会为固定 shape 搜索更快算法，deterministic 限制为可复现实现；性能与严格复现往往不能同时最大化。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/7_cudnn.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
torch.backends.cudnn.deterministic = True
# [变化示例] torch.backends.cudnn.deterministic=未定义/旧值 -> torch.backends.cudnn.deterministic=True；这是一次重新绑定/状态更新，右侧值决定新状态。
torch.backends.cudnn.benchmark = False
# [变化示例] torch.backends.cudnn.benchmark=未定义/旧值 -> torch.backends.cudnn.benchmark=False；这是一次重新绑定/状态更新，右侧值决定新状态。
```

#### 代码/API 逐项解释

- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 128. 可靠计时与性能分析 | 8_set_seed.py

**学习问题。** 如何集中配置端到端随机种子？

**中文讲解。** 一个可靠 helper 应覆盖 Python、NumPy、PyTorch CPU/CUDA，并明确 deterministic 与 benchmark 策略。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/8_set_seed.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
def set_seed(seed: int = 37) -> None:
# [变化示例] 调用该单行函数时：int=未定义/旧值 -> int=37) -> None:；这是一次重新绑定/状态更新，右侧值决定新状态。
    np.random.seed(seed)
    # [变化示例] 执行状态：调用 np.random.seed(seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    random.seed(seed)
    # [变化示例] 执行状态：调用 random.seed(seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.manual_seed(seed)  # 适用于所有PyTorch后端，包括CPU和所有CUDA设备
    # [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。
    torch.backends.cudnn.deterministic = True
    # [变化示例] torch.backends.cudnn.deterministic=未定义/旧值 -> torch.backends.cudnn.deterministic=True；这是一次重新绑定/状态更新，右侧值决定新状态。
    torch.backends.cudnn.benchmark = False
    # [变化示例] torch.backends.cudnn.benchmark=未定义/旧值 -> torch.backends.cudnn.benchmark=False；这是一次重新绑定/状态更新，右侧值决定新状态。

    os.environ["PYTHONHASHSEED"] = str(seed)
    # [变化示例] 目标切片 os.environ["PYTHONHASHSEED"]=旧值 -> str(seed)；base tensor 对应位置同步被写入。
    print(f"设置随机数种子为{seed}")
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 129. 可靠计时与性能分析 | 9_fix_gpu_clock.sh

**学习问题。** 为什么性能测试会固定 GPU 时钟？

**中文讲解。** 动态频率会让相同 kernel 的延迟漂移；锁频可降低噪声，但需要权限、硬件支持并会改变功耗/散热条件。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/9_fix_gpu_clock.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
# 查询
nvidia-smi --query-gpu=pstate,clocks.mem,clocks.sm,clocks.gr --format=csv
# [变化示例] GPU 时钟=动态 -> 请求锁定/查询指定频率；不支持时会返回错误而不改变时钟。

# clocks.current.memory [MHz], clocks.current.sm [MHz], clocks.current.graphics [MHz]
# 9751 MHz, 1695 MHz, 1695 MHz

# 查询GPU支持的clock组合
nvidia-smi --query-supported-clocks=gpu_name,mem,gr --format=csv
# [变化示例] GPU 时钟=动态 -> 请求锁定/查询指定频率；不支持时会返回错误而不改变时钟。

# 设置persistent mode
sudo nvidia-smi -pm 1
# [变化示例] GPU 时钟=动态 -> 请求锁定/查询指定频率；不支持时会返回错误而不改变时钟。

# 固定GPU时钟
nvidia-smi -ac 9751,1530 # <memory, graphics>
# [变化示例] GPU 时钟=动态 -> 请求锁定/查询指定频率；不支持时会返回错误而不改变时钟。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 130. 可靠计时与性能分析 | 10_clock_not_supported.sh

**学习问题。** 为什么性能测试会固定 GPU 时钟？

**中文讲解。** 动态频率会让相同 kernel 的延迟漂移；锁频可降低噪声，但需要权限、硬件支持并会改变功耗/散热条件。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/10_clock_not_supported.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
Setting applications clocks is not supported for GPU 00000000:1A:00.0.
# [变化示例] 命令状态：执行 Setting applications clocks is not supported for GPU 000000... 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
Treating as warning and moving on.
# [变化示例] 命令状态：执行 Treating as warning and moving on. 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 这是 nvidia-smi 的错误输出示例，不是可执行 shell 命令。

## 131. 可靠计时与性能分析 | 11_fix_cpu_clock.sh

**学习问题。** CPU 频率、C-state 和 Turbo 如何影响测量？

**中文讲解。** CPU 调频与睡眠状态会改变 host 侧延迟；严谨 benchmark 要记录 governor、频率和 Turbo/C-state 设置。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/11_fix_cpu_clock.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
# 安装
sudo apt install cpufrequtils
# [变化示例] 系统未安装工具 -> 包管理器安装完成（需要网络与 root 权限）。

# 设置最大/最小频率
sudo cpufreq-set -r -g performance
# [变化示例] CPU governor/频率=动态 -> performance 与指定上下限（需要 root）。
sudo cpufreq-set -r -d 2Ghz
# [变化示例] CPU governor/频率=动态 -> performance 与指定上下限（需要 root）。
sudo cpufreq-set -r -u 2Ghz
# [变化示例] CPU governor/频率=动态 -> performance 与指定上下限（需要 root）。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 132. 可靠计时与性能分析 | 12_query_cpu.sh

**学习问题。** CPU 频率、C-state 和 Turbo 如何影响测量？

**中文讲解。** CPU 调频与睡眠状态会改变 host 侧延迟；严谨 benchmark 要记录 governor、频率和 Turbo/C-state 设置。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/12_query_cpu.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
# 查询
cpufreq-info
# [变化示例] CPU 频率状态 -> 标准输出中的当前/最小/最大频率。

# 或者
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq
# [变化示例] CPU 频率状态 -> 标准输出中的当前/最小/最大频率。
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq
# [变化示例] CPU 频率状态 -> 标准输出中的当前/最小/最大频率。
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq
# [变化示例] CPU 频率状态 -> 标准输出中的当前/最小/最大频率。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 133. 可靠计时与性能分析 | 13_cpu_time.py

**学习问题。** 如何测量 CPU 墙钟时间？

**中文讲解。** time.perf_counter 提供适合短间隔测量的单调高分辨率时钟，但异步 GPU 工作必须额外同步。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/13_cpu_time.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import time

start = time.perf_counter()
# [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。

# 在此处运行你的代码

end = time.perf_counter()
# [变化示例] end=未定义/旧值 -> end=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
print(f"程序执行时间: {end - start}s")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 134. 可靠计时与性能分析 | 13_query_cstate.sh

**学习问题。** CPU 频率、C-state 和 Turbo 如何影响测量？

**中文讲解。** CPU 调频与睡眠状态会改变 host 侧延迟；严谨 benchmark 要记录 governor、频率和 Turbo/C-state 设置。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/13_query_cstate.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
# 查询 Cstate
cat /sys/module/intel_idle/parameters/max_cstate
# [变化示例] 内核/文件中的文本值 -> 标准输出；cat 不修改源文件。

# 查询 turbo状态
cat /sys/devices/system/cpu/intel_pstate/no_turbo
# [变化示例] 内核/文件中的文本值 -> 标准输出；cat 不修改源文件。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 135. 可靠计时与性能分析 | 14_warmup.py

**学习问题。** 为什么 benchmark 需要 warmup 和重复测量？

**中文讲解。** 首次运行可能包含导入、分配、缓存、编译和时钟爬升；warmup 后重复统计才更接近稳态。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/14_warmup.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import time
import torch


def my_work():
    # 需要计时的操作
    sz = 64
    # [变化示例] sz=未定义/旧值 -> sz=64；这是一次重新绑定/状态更新，右侧值决定新状态。
    x = torch.randn((sz, sz))
    # [变化示例] x=未定义/旧值 -> x=按 (sz, sz) 创建的随机张量；shape 固定，具体值由 RNG 决定。


if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    # 热身
    num_warmup = 5
    # [变化示例] num_warmup=未定义/旧值 -> num_warmup=5；这是一次重新绑定/状态更新，右侧值决定新状态。
    for i in range(num_warmup):
        # [变化示例] 循环示例：range(num_warmup) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        start = time.perf_counter()
        # [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
        my_work()
        # [变化示例] 执行状态：调用 my_work() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        end = time.perf_counter()
        # [变化示例] end=未定义/旧值 -> end=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
        t = end - start
        # [变化示例] t=未定义/旧值 -> t=end - start；数值示例：3 - 2 -> 1。
        print(f"热身#{i}: {t * 1000 :.6f}ms")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

    # 多次运行取平均
    repeat = 30
    # [变化示例] repeat=未定义/旧值 -> repeat=30；这是一次重新绑定/状态更新，右侧值决定新状态。
    start = time.perf_counter()
    # [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
    for _ in range(repeat):
        # [变化示例] 循环示例：range(repeat) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        my_work()
        # [变化示例] 执行状态：调用 my_work() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    end = time.perf_counter()
    # [变化示例] end=未定义/旧值 -> end=单调高分辨率时间戳；end-start -> 代码墙钟耗时。

    t = (end - start) / repeat
    # [变化示例] t=未定义/旧值 -> t=(end - start) / repeat；数值示例：6 / 3 -> 2。
    print(f"{repeat}次取平均: {t * 1000:.6f}ms")
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 热身#0: 0.317707ms
# 热身#1: 0.023586ms
# 热身#2: 0.016913ms
# 热身#3: 0.016409ms
# 热身#4: 0.015868ms
# 30次取平均: 0.014164ms
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 136. 可靠计时与性能分析 | 15_sync.py

**学习问题。** 为什么 CUDA 计时前后要 synchronize？

**中文讲解。** CUDA kernel 默认异步排队；只测 Python 提交时间会严重低估设备执行时间。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/15_sync.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import time
import torch

sz = 512
# [变化示例] sz=未定义/旧值 -> sz=512；这是一次重新绑定/状态更新，右侧值决定新状态。
N = 10
# [变化示例] N=未定义/旧值 -> N=10；这是一次重新绑定/状态更新，右侧值决定新状态。
shape = (sz, sz, sz)
# [变化示例] shape=未定义/旧值 -> shape=tuple (sz, sz, sz)；多个值按位置传递/解包，元素本身不被复制。

x = torch.randn(dtype=torch.float, size=shape, device="cuda")
# [变化示例] x=未定义/旧值 -> x=按 dtype=torch.float 创建的随机张量；shape 固定，具体值由 RNG 决定。
y = torch.randn(dtype=torch.float, size=shape, device="cuda")
# [变化示例] y=未定义/旧值 -> y=按 dtype=torch.float 创建的随机张量；shape 固定，具体值由 RNG 决定。

torch.cuda.synchronize()
# [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
start = time.perf_counter()
# [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
for _ in range(N):
    # [变化示例] 循环示例：range(N) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
    z = x * y
    # [变化示例] z=未定义/旧值 -> z=x * y；数值示例：2 * 3 -> 6。
# 同步
torch.cuda.synchronize()
# [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
end = time.perf_counter()
# [变化示例] end=未定义/旧值 -> end=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
print(f"{N}次运行取平均: {(end - start) / N}s")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 137. 可靠计时与性能分析 | 16_event.py

**学习问题。** CUDA Event 如何测 GPU 时间？

**中文讲解。** Event 记录在 CUDA stream 上，elapsed_time 计算设备时间线上的间隔，比 host perf_counter 更直接。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/16_event.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

sz = 512
# [变化示例] sz=未定义/旧值 -> sz=512；这是一次重新绑定/状态更新，右侧值决定新状态。
shape = (sz, sz, sz)
# [变化示例] shape=未定义/旧值 -> shape=tuple (sz, sz, sz)；多个值按位置传递/解包，元素本身不被复制。
x = torch.randn(dtype=torch.float, size=shape, device="cuda")
# [变化示例] x=未定义/旧值 -> x=按 dtype=torch.float 创建的随机张量；shape 固定，具体值由 RNG 决定。
y = torch.randn(dtype=torch.float, size=shape, device="cuda")
# [变化示例] y=未定义/旧值 -> y=按 dtype=torch.float 创建的随机张量；shape 固定，具体值由 RNG 决定。

start = torch.cuda.Event(enable_timing=True)
# [变化示例] start=未定义/旧值 -> start 接收 torch.cuda.Event(enable_timing=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
end = torch.cuda.Event(enable_timing=True)
# [变化示例] end=未定义/旧值 -> end 接收 torch.cuda.Event(enable_timing=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
start.record()
# [变化示例] 执行状态：调用 start.record() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
z = x + y
# [变化示例] z=未定义/旧值 -> z=x + y；数值示例：2 + 3 -> 5。
end.record()
# [变化示例] 执行状态：调用 end.record() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# 等待GPU运行完成
torch.cuda.synchronize()
# [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。

print(f"用时{start.elapsed_time(end)}ms")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 138. 可靠计时与性能分析 | 17_profile_basic.py

**学习问题。** torch.profiler 如何定位热点算子？

**中文讲解。** 同时采集 CPU/CUDA activity，并按 cuda_time_total 聚合，可区分 host 调度与 GPU kernel 成本。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/17_profile_basic.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torchvision.models as models
from torch.profiler import profile, record_function, ProfilerActivity

model = models.resnet18().cuda()
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
inputs = torch.randn(5, 3, 224, 224, device="cuda")
# [变化示例] inputs=未定义/旧值 -> inputs=按 5, 3, 224, 224 创建的随机张量；shape 固定，具体值由 RNG 决定。

with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    with record_function("model_inference"):
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        model(inputs)
        # [变化示例] 执行状态：调用 model(inputs) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=10))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 139. 可靠计时与性能分析 | 18_profile_memory.py

**学习问题。** 如何用 profiler 分析算子显存？

**中文讲解。** profile_memory 会记录分配与释放事件；self memory 更接近算子自身分配，total memory 还包含子调用。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/18_profile_memory.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torchvision.models as models
from torch.profiler import profile, record_function, ProfilerActivity

model = models.resnet18().cuda()
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
inputs = torch.randn(5, 3, 224, 224, device="cuda")
# [变化示例] inputs=未定义/旧值 -> inputs=按 5, 3, 224, 224 创建的随机张量；shape 固定，具体值由 RNG 决定。

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA], profile_memory=True
) as prof:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    model(inputs)
    # [变化示例] 执行状态：调用 model(inputs) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

print(prof.key_averages().table(sort_by="self_cuda_memory_usage", row_limit=5))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 140. 可靠计时与性能分析 | 19_profile_export.py

**学习问题。** 如何把 profiler 结果导出到 Chrome Trace？

**中文讲解。** 导出的 JSON 可在时间线上观察 CPU op、CUDA kernel、stream 并发和空洞；该片段依赖已创建的 prof 对象。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/19_profile_export.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
prof.export_chrome_trace("profiler_export_trace.json")
# [变化示例] 执行状态：调用 prof.export_chrome_trace("profiler_export_trace.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 该文件是片段，必须在创建并完成 prof 上下文后调用。

## 141. 可靠计时与性能分析 | 20_ncu.py

**学习问题。** 怎样准备一个可供 Nsight Compute 分析的训练 workload？

**中文讲解。** 构造重复的 CNN 前向、反向和优化器步骤，使 ncu 能采集关键 kernel 的 occupancy、访存和指令指标。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/20_ncu.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
import torch.optim as optim


class SimpleCNN(nn.Module):
    def __init__(self):
        super(SimpleCNN, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleCNN, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.conv1 = nn.Conv2d(1, 20, 5)
        # [变化示例] self.conv1=未定义/旧值 -> self.conv1 接收 nn.Conv2d(1, 20, 5) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.pool = nn.MaxPool2d(2, 2)
        # [变化示例] self.pool=未定义/旧值 -> self.pool 接收 nn.MaxPool2d(2, 2) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.conv2 = nn.Conv2d(20, 50, 5)
        # [变化示例] self.conv2=未定义/旧值 -> self.conv2 接收 nn.Conv2d(20, 50, 5) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.fc1 = nn.Linear(50 * 4 * 4, 500)
        # [变化示例] self.fc1=未定义/旧值 -> self.fc1=线性映射模块；输入最后一维 50 * 4 * 4 -> 输出最后一维 500。
        self.fc2 = nn.Linear(500, 10)
        # [变化示例] self.fc2=未定义/旧值 -> self.fc2=线性映射模块；输入最后一维 500 -> 输出最后一维 10。

    def forward(self, x):
        x = self.pool(torch.relu(self.conv1(x)))
        # [变化示例] x=未定义/旧值 -> x 接收 self.pool(torch.relu(self.conv1(x))) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = self.pool(torch.relu(self.conv2(x)))
        # [变化示例] x=未定义/旧值 -> x 接收 self.pool(torch.relu(self.conv2(x))) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = x.view(-1, 50 * 4 * 4)
        # [变化示例] x=未定义/旧值 -> x 重排为 -1, 50 * 4 * 4；元素数量与顺序保持不变（若布局允许则共享 storage）。
        x = torch.relu(self.fc1(x))
        # [变化示例] x=未定义/旧值 -> x=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        x = self.fc2(x)
        # [变化示例] x=未定义/旧值 -> x 接收 self.fc2(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return x
        # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


net = SimpleCNN().to("cuda")
# [变化示例] net=未定义/旧值 -> net 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
criterion = nn.CrossEntropyLoss()
# [变化示例] criterion=未定义/旧值 -> criterion=分类损失/损失模块；例如 logits (B,C) 与 labels (B,) -> 标量平均 loss。
optimizer = optim.SGD(net.parameters(), lr=0.001, momentum=0.9)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。

for i in range(10):
    # [变化示例] 循环示例：range(10) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
    inputs = torch.randn(32, 1, 28, 28, device="cuda")
    # [变化示例] inputs=未定义/旧值 -> inputs=按 32, 1, 28, 28 创建的随机张量；shape 固定，具体值由 RNG 决定。
    labels = torch.randint(0, 10, (32,), device="cuda")
    # [变化示例] labels=未定义/旧值 -> labels=指定整数区间的随机张量；例如 randint(0,10,(32,)) -> shape=(32,)，值均在 [0,10)。
    optimizer.zero_grad()
    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
    outputs = net(inputs)
    # [变化示例] outputs=未定义/旧值 -> outputs 接收 net(inputs) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    loss = criterion(outputs, labels)
    # [变化示例] loss=未定义/旧值 -> loss 接收 criterion(outputs, labels) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    loss.backward()
    # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
    optimizer.step()
    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。
- 概率与损失：交叉熵通常接收未归一化 logits；采样前按最后一维归一化并处理 temperature/top-k。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 142. 可靠计时与性能分析 | 21_py_spy.py

**学习问题。** 如何区分 Python/NumPy 热点与 GPU 热点？

**中文讲解。** py-spy 采样 Python 调用栈，torch.profiler 分析框架与 CUDA；两者结合才能识别 host preprocessing 瓶颈。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/21_py_spy.py`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import numpy as np
from torch.profiler import profile, record_function, ProfilerActivity


class SimpleModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.linear = torch.nn.Linear(10, 10)
        # [变化示例] self.linear=未定义/旧值 -> self.linear 接收 torch.nn.Linear(10, 10) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    def forward(self, x):
        return self.linear(x)
        # [变化示例] 函数内部：执行 self.linear(x) 得到结果 -> 调用方收到该输出。


def numpy_heavy_computation(input_array):
    size_inner = 1000
    # [变化示例] size_inner=未定义/旧值 -> size_inner=1000；这是一次重新绑定/状态更新，右侧值决定新状态。
    size_0 = input_array.shape[0]
    # [变化示例] size_0=未定义/旧值 -> size_0=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
    size_1 = input_array.shape[1]
    # [变化示例] size_1=未定义/旧值 -> size_1=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
    result = input_array
    # [变化示例] result=未定义/旧值 -> result=input_array；这是一次重新绑定/状态更新，右侧值决定新状态。
    for _ in range(2):
        # [变化示例] 循环示例：range(2) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        matrix_a = np.random.randn(size_0, size_inner)
        # [变化示例] matrix_a=未定义/旧值 -> matrix_a 接收 np.random.randn(size_0, size_inner) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        matrix_b = np.random.randn(size_inner, size_1)
        # [变化示例] matrix_b=未定义/旧值 -> matrix_b 接收 np.random.randn(size_inner, size_1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        result = np.dot(matrix_a, matrix_b) + result
        # [变化示例] result=未定义/旧值 -> result=np.dot(matrix_a, matrix_b) + result；数值示例：2 + 3 -> 5。
    return result
    # [变化示例] 函数内部：result；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


def run(data, model):
    processed_data = numpy_heavy_computation(data)
    # [变化示例] processed_data=未定义/旧值 -> processed_data 接收 numpy_heavy_computation(data) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    tensor_data = torch.tensor(
        processed_data[:10, :10], dtype=torch.float32, device="cuda"
    )
    # [变化示例] tensor_data=未定义/旧值 -> tensor_data=由给定数据构造的 tensor，并采用显式/推断的 dtype 与 device。
    output = model(tensor_data)
    # [变化示例] output=未定义/旧值 -> output 接收 model(tensor_data) 的返回值；用 shape/dtype/device 与示例输入核对变化。


def main():
    model = SimpleModel().to("cuda")
    # [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    data = np.random.randn(10, 10)
    # [变化示例] data=未定义/旧值 -> data 接收 np.random.randn(10, 10) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    for i in range(1000):
        # [变化示例] 循环示例：range(1000) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        run(data, model)
        # [变化示例] 执行状态：调用 run(data, model) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。


if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    main()
    # [变化示例] 执行状态：调用 main() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 143. 可靠计时与性能分析 | 22_pyspy_cmd.sh

**学习问题。** 如何生成 Python 火焰图？

**中文讲解。** py-spy record 以采样方式附着/启动进程并输出 SVG，开销通常低于逐函数 instrumentation。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/22_pyspy_cmd.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
py-spy record -o profile.svg -- python test.py
# [变化示例] 运行中的 Python 调用栈 -> 采样生成 profile.svg 火焰图。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 144. 可靠计时与性能分析 | 23_strace.sh

**学习问题。** strace 何时能帮助排查训练卡顿？

**中文讲解。** 它观察 open/read/write/futex 等系统调用，可发现频繁小文件 I/O、锁等待或异常重试，但会带来额外开销。 性能结论必须建立在可复现环境、正确同步、充分 warmup 和合适 profiler 上。

**来源文件。** `chapter_04_profiler/23_strace.sh`

#### 数学、性能模型与算法思路

$$
t_{reported}=t_{work}+t_{launch}+t_{sync}+\epsilon_{system}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
# 通过strace运行一个程序
strace python test.py
# [变化示例] 目标进程 -> 持续输出系统调用轨迹；附着期间程序行为不应被当作零开销。

# 追踪一个已经运行的进程
strace -p <pid>
# [变化示例] 目标进程 -> 持续输出系统调用轨迹；附着期间程序行为不应被当作零开销。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先 warmup，固定输入与环境，重复多轮；CUDA host 计时前后同步，并报告中位数/分位数而不是只报单次结果。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 145. 数据管线与 DataLoader | 0_cifar.sh

**学习问题。** 如何准备 CIFAR-10 数据文件？

**中文讲解。** 下载脚本负责获取并解压数据；生产流程还应校验 checksum、避免重复下载并记录数据版本。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/0_cifar.sh`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
cifar-10-raw-images
# [变化示例] 命令状态：执行 cifar-10-raw-images 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
|- images
# [变化示例] 命令状态：执行 |- images 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
    |- train
    # [变化示例] 命令状态：执行 |- train 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
        |- Airplane
        # [变化示例] 命令状态：执行 |- Airplane 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
            |- aeroplane_s_000004.png
            # [变化示例] 命令状态：执行 |- aeroplane_s_000004.png 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
            |- ...
            # [变化示例] 命令状态：执行 |- ... 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
        |- Automobile
        # [变化示例] 命令状态：执行 |- Automobile 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
        |- Bird
        # [变化示例] 命令状态：执行 |- Bird 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
        |- ...
        # [变化示例] 命令状态：执行 |- ... 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 146. 数据管线与 DataLoader | 1_from_numpy.py

**学习问题。** torch.from_numpy 是否复制内存？

**中文讲解。** 对受支持 dtype/layout 的 ndarray，from_numpy 通常共享 CPU 内存；任一侧原地修改都可能影响另一侧。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/1_from_numpy.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import numpy as np
import torch

x = np.zeros((3, 3))
# [变化示例] x=未定义/旧值 -> x 接收 np.zeros((3, 3)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
y = torch.from_numpy(x)
# [变化示例] y=未定义/旧值 -> y 接收 torch.from_numpy(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

print(y, type(y))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# tensor([[0., 0., 0.],
#        [0., 0., 0.],
#        [0., 0., 0.]], dtype=torch.float64) <class 'torch.Tensor'>
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 147. 数据管线与 DataLoader | 2_from_numpy_error.py

**学习问题。** 为什么负 stride 的 NumPy 数组不能直接转 tensor？

**中文讲解。** 翻转等操作可能产生负 stride view，而 torch.from_numpy 要求当前支持的非负 stride；copy 可物化连续布局。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/2_from_numpy_error.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import numpy as np
import torch

x = np.random.random(size=(4, 4, 2))
# [变化示例] x=未定义/旧值 -> x 接收 np.random.random(size=(4, 4, 2)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
y = np.flip(x, axis=0)
# [变化示例] y=未定义/旧值 -> y 接收 np.flip(x, axis=0) 的返回值；用 shape/dtype/device 与示例输入核对变化。

# 报错
# ValueError: At least one stride in the given numpy array is negative,
# and tensors with negative strides are not currently supported.
# (You can probably work around this by making a copy of your array  with array.copy().)
torch.from_numpy(y)
# [变化示例] 执行状态：调用 torch.from_numpy(y) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# 创建副本后能够正常运行
torch.from_numpy(y.copy())
# [变化示例] 执行状态：调用 torch.from_numpy(y.copy()) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 此文件故意触发负 stride 错误；修复方式是 np.ascontiguousarray(array) 或 array.copy() 后再 from_numpy。

## 148. 数据管线与 DataLoader | 3_predefined_dataset.py

**学习问题。** 如何使用 torchvision 预定义数据集？

**中文讲解。** Dataset 负责样本与标签，download/transform 管理获取和预处理；训练与验证 transform 应分开。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/3_predefined_dataset.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torchvision.datasets as datasets
import torchvision.transforms as transforms

transform = transforms.Compose([transforms.ToTensor()])
# [变化示例] transform=未定义/旧值 -> transform 接收 transforms.Compose([transforms.ToTensor()]) 的返回值；用 shape/dtype/device 与示例输入核对变化。

train_dataset = datasets.CIFAR10(
    root="./data", train=True, download=True, transform=transform
)
# [变化示例] train_dataset=未定义/旧值 -> train_dataset 接收 datasets.CIFAR10( root="./data", train=True, download=True,... 的返回值；用 shape/dtype/device 与示例输入核对变化。
test_dataset = datasets.CIFAR10(
    root="./data", train=False, download=True, transform=transform
)
# [变化示例] test_dataset=未定义/旧值 -> test_dataset 接收 datasets.CIFAR10( root="./data", train=False, download=True... 的返回值；用 shape/dtype/device 与示例输入核对变化。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 149. 数据管线与 DataLoader | 4_custom_dataset.py

**学习问题。** 自定义 Dataset 需要实现哪些契约？

**中文讲解。** map-style Dataset 至少实现 __len__ 与 __getitem__，返回可被 collate_fn 合并的稳定样本结构。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/4_custom_dataset.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import os
import numpy as np
import torch
from torch.utils.data import Dataset
from PIL import Image


class CifarDataset(Dataset):
    label_encoder_ = {
        "Airplane": 0,
        "Automobile": 1,
        "Bird": 2,
        "Cat": 3,
        "Deer": 4,
        "Dog": 5,
        "Frog": 6,
        "Horse": 7,
        "Ship": 8,
        "Truck": 9,
    }
    # [变化示例] label_encoder_=未定义/旧值 -> label_encoder_={ "Airplane": 0, "Automobile": 1, "Bird": 2, "Cat": 3, "Dee...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

    def __init__(self, root_folder):
        self.image_label_pairs = []
        # [变化示例] self.image_label_pairs=未定义/旧值 -> self.image_label_pairs=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        # construct list of: (image_path, label)
        train_foldername = "images/train"
        # [变化示例] train_foldername=未定义/旧值 -> train_foldername="images/train"；这是一次重新绑定/状态更新，右侧值决定新状态。
        train_path = os.path.join(root_folder, train_foldername)
        # [变化示例] train_path=未定义/旧值 -> train_path 接收 os.path.join(root_folder, train_foldername) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        class_folders = os.listdir(train_path)
        # [变化示例] class_folders=未定义/旧值 -> class_folders 接收 os.listdir(train_path) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        for class_name in class_folders:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            class_folder_path = os.path.join(train_path, class_name)
            # [变化示例] class_folder_path=未定义/旧值 -> class_folder_path 接收 os.path.join(train_path, class_name) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            image_names = os.listdir(class_folder_path)
            # [变化示例] image_names=未定义/旧值 -> image_names 接收 os.listdir(class_folder_path) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            for image_name in image_names:
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                image_path = os.path.join(class_folder_path, image_name)
                # [变化示例] image_path=未定义/旧值 -> image_path 接收 os.path.join(class_folder_path, image_name) 的返回值；用 shape/dtype/device 与示例输入核对变化。
                label = self.encode_label(class_name)
                # [变化示例] label=未定义/旧值 -> label 接收 self.encode_label(class_name) 的返回值；用 shape/dtype/device 与示例输入核对变化。
                self.image_label_pairs.append((image_path, label))
                # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。

    def __len__(self):
        return len(self.image_label_pairs)
        # [变化示例] 函数内部：执行 len(self.image_label_pairs) 得到结果 -> 调用方收到该输出。

    def __getitem__(self, idx):
        image_path, label = self.image_label_pairs[idx]
        # [变化示例] image_path, label=未定义/旧值 -> image_path, label=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。

        img = Image.open(image_path)
        # [变化示例] img=未定义/旧值 -> img 接收 Image.open(image_path) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        img_array = np.array(img)
        # [变化示例] img_array=未定义/旧值 -> img_array 接收 np.array(img) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        img_tensor = torch.tensor(img_array)
        # [变化示例] img_tensor=未定义/旧值 -> img_tensor=由给定数据构造的 tensor，并采用显式/推断的 dtype 与 device。
        return img_tensor, label
        # [变化示例] 函数内部：tuple (img_tensor, label)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。

    def encode_label(self, label_str):
        assert isinstance(label_str, str)
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        return CifarDataset.label_encoder_[label_str]
        # [变化示例] 函数内部：索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,) -> 调用方收到该输出。


if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    dataset = CifarDataset("/home/ailing/Downloads/cifar10-raw-images/")
    # [变化示例] dataset=未定义/旧值 -> dataset 接收 CifarDataset("/home/ailing/Downloads/cifar10-raw-images/") 的返回值；用 shape/dtype/device 与示例输入核对变化。
    for i in range(len(dataset)):
        # [变化示例] 循环示例：range(len(dataset) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        img_data, label = dataset[i]
        # [变化示例] img_data, label=未定义/旧值 -> img_data, label=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        print("image: ", img_data.shape, "label: ", label)
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 150. 数据管线与 DataLoader | 5_dataloder.py

**学习问题。** DataLoader 的 batch、shuffle、worker 和 pin_memory 如何协作？

**中文讲解。** sampler 决定索引顺序，worker 并行读取/预处理，collate 组成 batch，pin_memory 可加速异步 H2D。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/5_dataloder.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    dataset = CifarDataset("path/to/cifar-10")
    # [变化示例] dataset=未定义/旧值 -> dataset 接收 CifarDataset("path/to/cifar-10") 的返回值；用 shape/dtype/device 与示例输入核对变化。

    dataloader = DataLoader(
        dataset, batch_size=4, shuffle=True, drop_last=True, num_workers=0
    )
    # [变化示例] dataloader=未定义/旧值 -> dataloader=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。
    for i, batch in enumerate(dataloader):
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        img_data, label = batch
        # [变化示例] img_data, label=未定义/旧值 -> img_data, label=batch；这是一次重新绑定/状态更新，右侧值决定新状态。
        print("image: ", img_data.shape, "label: ", label)
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 151. 数据管线与 DataLoader | 6_dataloader_result.sh

**学习问题。** DataLoader 的 batch、shuffle、worker 和 pin_memory 如何协作？

**中文讲解。** sampler 决定索引顺序，worker 并行读取/预处理，collate 组成 batch，pin_memory 可加速异步 H2D。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/6_dataloader_result.sh`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
image:  torch.Size([4, 32, 32, 3]) label:  tensor([8, 8, 0, 3])
# [变化示例] 命令状态：执行 image: torch.Size([4, 32, 32, 3]) label: tensor([8, 8, 0, 3]) 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 这是 benchmark 结果记录，不应直接作为 shell 脚本执行。

## 152. 数据管线与 DataLoader | 7_pil.py

**学习问题。** PIL 图像解码为什么可能成为瓶颈？

**中文讲解。** JPEG/PNG 解码和 Python transform 在 CPU 上执行；小文件随机访问时 I/O 与解码常盖过模型等待时间。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/7_pil.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
from PIL import Image
import time


def resize_image(image_path, output_size):
    with Image.open(image_path) as img:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        img = img.resize(output_size)
        # [变化示例] img=未定义/旧值 -> img 接收 img.resize(output_size) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        img.save("output.png")
        # [变化示例] 执行状态：调用 img.save("output.png") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


image_path = "example.png"
# [变化示例] image_path=未定义/旧值 -> image_path="example.png"；这是一次重新绑定/状态更新，右侧值决定新状态。
output_size = (4096, 4096)  # 新的尺寸
# [变化示例] output_size=未定义/旧值 -> output_size=tuple (4096, 4096)；多个值按位置传递/解包，元素本身不被复制。

# 开始计时
start_time = time.time()
# [变化示例] start_time=未定义/旧值 -> start_time 接收 time.time() 的返回值；用 shape/dtype/device 与示例输入核对变化。

# 执行图像缩放
resize_image(image_path, output_size)
# [变化示例] 执行状态：调用 resize_image(image_path, output_size) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# 计算耗时
duration = time.time() - start_time
# [变化示例] duration=未定义/旧值 -> duration=time.time() - start_time；数值示例：3 - 2 -> 1。
print(f"Time taken: {duration} seconds")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 153. 数据管线与 DataLoader | 8_np_thread.py

**学习问题。** NumPy 内部线程为什么会与 DataLoader worker 过度订阅？

**中文讲解。** 每个 worker 若再启动多个 BLAS/OpenMP 线程，会造成线程数乘法膨胀；限制每进程线程数常能提升吞吐稳定性。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/8_np_thread.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import numpy as np
import pdb

pdb.set_trace()
# [变化示例] 执行状态：调用 pdb.set_trace() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 154. 数据管线与 DataLoader | 9_limit_np_thread.py

**学习问题。** NumPy 内部线程为什么会与 DataLoader worker 过度订阅？

**中文讲解。** 每个 worker 若再启动多个 BLAS/OpenMP 线程，会造成线程数乘法膨胀；限制每进程线程数常能提升吞吐稳定性。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/9_limit_np_thread.py`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
from os import environ

# 控制NumPy底层库创建的线程数量
N_THREADS = "4"
# [变化示例] N_THREADS=未定义/旧值 -> N_THREADS="4"；这是一次重新绑定/状态更新，右侧值决定新状态。
environ["OMP_NUM_THREADS"] = N_THREADS
# [变化示例] 目标切片 environ["OMP_NUM_THREADS"]=旧值 -> N_THREADS；base tensor 对应位置同步被写入。
environ["OPENBLAS_NUM_THREADS"] = N_THREADS
# [变化示例] 目标切片 environ["OPENBLAS_NUM_THREADS"]=旧值 -> N_THREADS；base tensor 对应位置同步被写入。
environ["MKL_NUM_THREADS"] = N_THREADS
# [变化示例] 目标切片 environ["MKL_NUM_THREADS"]=旧值 -> N_THREADS；base tensor 对应位置同步被写入。
environ["VECLIB_MAXIMUM_THREADS"] = N_THREADS
# [变化示例] 目标切片 environ["VECLIB_MAXIMUM_THREADS"]=旧值 -> N_THREADS；base tensor 对应位置同步被写入。
environ["NUMEXPR_NUM_THREADS"] = N_THREADS
# [变化示例] 目标切片 environ["NUMEXPR_NUM_THREADS"]=旧值 -> N_THREADS；base tensor 对应位置同步被写入。

import numpy as np

import pdb

pdb.set_trace()
# [变化示例] 执行状态：调用 pdb.set_trace() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
x = np.zeros((1024, 1024))
# [变化示例] x=未定义/旧值 -> x 接收 np.zeros((1024, 1024)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 155. 数据管线与 DataLoader | 10_iostat.sh

**学习问题。** 如何判断数据加载是否受磁盘限制？

**中文讲解。** iostat 展示吞吐、队列和设备利用率；高 await/util 且 GPU 空闲通常说明 I/O 是候选瓶颈。 训练吞吐不仅取决于 GPU；磁盘、解码、NumPy 线程、worker 和 H2D 拷贝都可能成为瓶颈。

**来源文件。** `chapter_05_data/10_iostat.sh`

#### 数学、性能模型与算法思路

$$
throughput=\min(r_{storage},r_{decode},r_{workers},r_{H2D},r_{GPU})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
iostat -xtck 2
# [变化示例] 块设备运行状态 -> 吞吐、await、队列与利用率统计。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 记录 samples/s、DataLoader 等待时间、CPU/磁盘/GPU 利用率，并检查 worker 输出与单进程版本数值一致。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 156. 计算优化 | 1_num_worker.py

**学习问题。** 如何选择 DataLoader num_workers？

**中文讲解。** worker 太少会供不上 GPU，太多会增加进程、内存和上下文切换；必须针对数据介质与 transform 实测。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/1_num_worker.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
from torch import nn
from torch.profiler import profile, ProfilerActivity
import torchvision.transforms as transforms
from torchvision.datasets import CIFAR10
from torch.utils.data import DataLoader


class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleNet, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.fc1 = nn.Linear(512, 10000)
        # [变化示例] self.fc1=未定义/旧值 -> self.fc1=线性映射模块；输入最后一维 512 -> 输出最后一维 10000。
        self.fc2 = nn.Linear(10000, 1000)
        # [变化示例] self.fc2=未定义/旧值 -> self.fc2=线性映射模块；输入最后一维 10000 -> 输出最后一维 1000。
        self.fc3 = nn.Linear(1000, 10)
        # [变化示例] self.fc3=未定义/旧值 -> self.fc3=线性映射模块；输入最后一维 1000 -> 输出最后一维 10。

    def forward(self, x):
        out = self.fc1(x)
        # [变化示例] out=未定义/旧值 -> out 接收 self.fc1(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        out = self.fc2(out)
        # [变化示例] out=未定义/旧值 -> out 接收 self.fc2(out) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        out = self.fc3(out)
        # [变化示例] out=未定义/旧值 -> out 接收 self.fc3(out) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return out
        # [变化示例] 函数内部：out；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


if torch.cuda.is_available():
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    device = torch.device("cuda")
    # [变化示例] device=未定义/旧值 -> device 接收 torch.device("cuda") 的返回值；用 shape/dtype/device 与示例输入核对变化。
    activities = [ProfilerActivity.CPU, ProfilerActivity.CUDA]
    # [变化示例] activities=未定义/旧值 -> activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
else:
    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
    device = torch.device("cpu")
    # [变化示例] device=未定义/旧值 -> device 接收 torch.device("cpu") 的返回值；用 shape/dtype/device 与示例输入核对变化。
    activities = [ProfilerActivity.CPU]
    # [变化示例] activities=未定义/旧值 -> activities=[ProfilerActivity.CPU]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

model = SimpleNet().to(device)
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
optimizer = torch.optim.SGD(model.parameters(), lr=0.01)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。


def train(model, optimizer, trainloader, num_iters, device):
    with profile(activities=activities) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for i, batch in enumerate(trainloader, 0):
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            if i >= num_iters:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                break
            data = batch[0].to(device)
            # [变化示例] data=未定义/旧值 -> data 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

            # 前向
            optimizer.zero_grad()
            # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
            output = model(data)
            # [变化示例] output=未定义/旧值 -> output 接收 model(data) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            loss = output.sum()
            # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

            # 反向
            loss.backward()
            # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
            optimizer.step()
            # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
    prof.export_chrome_trace(f"traces/PROF_workers_{trainloader.num_workers}.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_workers_{trainloader... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


num_workers = 0
# [变化示例] num_workers=未定义/旧值 -> num_workers=0；这是一次重新绑定/状态更新，右侧值决定新状态。
transform = transforms.Compose(
    [transforms.ToTensor(), transforms.Resize([512, 512])]
)
# [变化示例] transform=未定义/旧值 -> transform 接收 transforms.Compose( [transforms.ToTensor(), transforms.Resi... 的返回值；用 shape/dtype/device 与示例输入核对变化。
trainset = CIFAR10(root="./data", train=True, download=True, transform=transform)
# [变化示例] trainset=未定义/旧值 -> trainset 接收 CIFAR10(root="./data", train=True, download=True, transform... 的返回值；用 shape/dtype/device 与示例输入核对变化。
trainloader = DataLoader(trainset, batch_size=32, num_workers=num_workers)
# [变化示例] trainloader=未定义/旧值 -> trainloader=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。

train(model, optimizer, trainloader, num_iters=20, device=device)
# [变化示例] 执行状态：调用 train(model, optimizer, trainloader, num_iters=20, device=d... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 157. 计算优化 | 2_non_blocking.py

**学习问题。** non_blocking=True 何时真正异步？

**中文讲解。** CPU 张量通常必须位于 pinned memory，且后续计算位于合适 CUDA stream；否则调用可能仍同步或没有重叠收益。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/2_non_blocking.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
def train(model, optimizer, trainloader, num_iters):
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for i, batch in enumerate(trainloader, 0):
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            if i >= num_iters:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                break
            data = batch[0].cuda(non_blocking=True)
            # [变化示例] data=未定义/旧值 -> data 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

            optimizer.zero_grad()
            # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
            output = model(data)
            # [变化示例] output=未定义/旧值 -> output 接收 model(data) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            loss = output.sum()
            # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

            loss.backward()
            # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
            optimizer.step()
            # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

    prof.export_chrome_trace(f"traces/PROF_non_blocking.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_non_blocking.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


transform = transforms.Compose(
    [transforms.ToTensor(), transforms.Resize([512, 512])]
)
# [变化示例] transform=未定义/旧值 -> transform 接收 transforms.Compose( [transforms.ToTensor(), transforms.Resi... 的返回值；用 shape/dtype/device 与示例输入核对变化。
trainset = CIFAR10(root="./data", train=True, download=True, transform=transform)
# [变化示例] trainset=未定义/旧值 -> trainset 接收 CIFAR10(root="./data", train=True, download=True, transform... 的返回值；用 shape/dtype/device 与示例输入核对变化。
trainloader = DataLoader(trainset, batch_size=4, pin_memory=True, num_workers=4)
# [变化示例] trainloader=未定义/旧值 -> trainloader=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。


# non_blocking
train(model, optimizer, trainloader, num_iters=20)
# [变化示例] 执行状态：调用 train(model, optimizer, trainloader, num_iters=20) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 异步传输与 stream：是否真正重叠取决于 pinned memory、stream 依赖和后续同步。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 158. 计算优化 | 3_double_buffering.py

**学习问题。** 双缓冲如何重叠数据传输与计算？

**中文讲解。** 在独立 stream 预取下一 batch，同时当前 stream 计算当前 batch，并用 event/stream wait 建立正确依赖。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/3_double_buffering.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
def train(model, optimizer, trainloader, num_iters):
    # Create two CUDA streams
    stream1 = torch.cuda.Stream()
    # [变化示例] stream1=未定义/旧值 -> stream1 接收 torch.cuda.Stream() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    stream2 = torch.cuda.Stream()
    # [变化示例] stream2=未定义/旧值 -> stream2 接收 torch.cuda.Stream() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    submit_stream = stream1
    # [变化示例] submit_stream=未定义/旧值 -> submit_stream=stream1；这是一次重新绑定/状态更新，右侧值决定新状态。
    running_stream = stream2
    # [变化示例] running_stream=未定义/旧值 -> running_stream=stream2；这是一次重新绑定/状态更新，右侧值决定新状态。
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for i, batch in enumerate(trainloader, 0):
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            if i >= num_iters:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                break

            with torch.cuda.stream(submit_stream):
                # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
                data = batch[0].cuda(non_blocking=True)
                # [变化示例] data=未定义/旧值 -> data 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
                submit_stream.wait_stream(running_stream)
                # [变化示例] 执行状态：调用 submit_stream.wait_stream(running_stream) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

                # Forward pass
                optimizer.zero_grad()
                # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
                output = model(data)
                # [变化示例] output=未定义/旧值 -> output 接收 model(data) 的返回值；用 shape/dtype/device 与示例输入核对变化。
                loss = output.sum()
                # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

                # Backward pass and optimize
                loss.backward()
                # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
                optimizer.step()
                # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

            # Alternate between the two streams
            submit_stream = stream2 if submit_stream == stream1 else stream1
            # [变化示例] submit_stream=未定义/旧值 -> submit_stream=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
            running_stream = stream2 if running_stream == stream1 else stream1
            # [变化示例] running_stream=未定义/旧值 -> running_stream=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。

    prof.export_chrome_trace(f"PROF_double_buffering_wait_after_data.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"PROF_double_buffering_wait_after... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- 异步传输与 stream：是否真正重叠取决于 pinned memory、stream 依赖和后续同步。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 159. 计算优化 | 4_batch_size.py

**学习问题。** 增大 batch 为什么常能提升 GPU 利用率？

**中文讲解。** 更大 batch 增加并行工作和算术强度，但也提高激活显存并可能改变优化统计与收敛。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/4_batch_size.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import time

import torch
from torch.utils.data import DataLoader
from torch.profiler import profile, ProfilerActivity

from torchvision.models import resnet18
from torchvision.datasets import CIFAR10
from torchvision.transforms import Compose, ToTensor, Normalize

# 设置batchsize
batch_size = 4
# [变化示例] batch_size=未定义/旧值 -> batch_size=4；这是一次重新绑定/状态更新，右侧值决定新状态。

transform = Compose([ToTensor(), Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))])
# [变化示例] transform=未定义/旧值 -> transform 接收 Compose([ToTensor(), Normalize((0.5, 0.5, 0.5), (0.5, 0.5, ... 的返回值；用 shape/dtype/device 与示例输入核对变化。
trainset = CIFAR10(root="./data", train=True, download=True, transform=transform)
# [变化示例] trainset=未定义/旧值 -> trainset 接收 CIFAR10(root="./data", train=True, download=True, transform... 的返回值；用 shape/dtype/device 与示例输入核对变化。
trainloader = DataLoader(trainset, batch_size=batch_size, num_workers=10)
# [变化示例] trainloader=未定义/旧值 -> trainloader=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。


device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
# [变化示例] device=未定义/旧值 -> device=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
model = resnet18().to(device)
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
optimizer = torch.optim.SGD(model.parameters(), lr=0.1, momentum=0.9)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。


def train_num_batches(trainloader, model, device, num_batches):
    for i, data in enumerate(trainloader, 0):
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        if i >= num_batches:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            break

        inputs, labels = data[0].to(device), data[1].to(device)
        # [变化示例] inputs, labels=未定义/旧值 -> inputs, labels 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

        outputs = model(inputs)
        # [变化示例] outputs=未定义/旧值 -> outputs 接收 model(inputs) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        loss = torch.nn.CrossEntropyLoss()(outputs, labels)
        # [变化示例] loss=未定义/旧值 -> loss 接收 torch.nn.CrossEntropyLoss()(outputs, labels) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        optimizer.zero_grad()
        # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。

        loss.backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
        optimizer.step()
        # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。


# 热身
train_num_batches(trainloader, model, device, num_batches=5)
# [变化示例] 执行状态：调用 train_num_batches(trainloader, model, device, num_batches=5) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
num_batches = len(trainloader) / batch_size
# [变化示例] num_batches=未定义/旧值 -> num_batches=len(trainloader) / batch_size；数值示例：6 / 3 -> 2。

start = time.perf_counter()
# [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
train_num_batches(trainloader, model, device, num_batches=num_batches)
# [变化示例] 执行状态：调用 train_num_batches(trainloader, model, device, num_batches=n... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
torch.cuda.synchronize()
# [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
end = time.perf_counter() - start
# [变化示例] end=未定义/旧值 -> end=time.perf_counter() - start；数值示例：3 - 2 -> 1。
print(f"batch_size={batch_size} 运行时间: {end * 1000} ms")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    train_num_batches(trainloader, model, device, num_batches=10)
    # [变化示例] 执行状态：调用 train_num_batches(trainloader, model, device, num_batches=10) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
prof.export_chrome_trace(f"traces/PROF_resnet18_batchsize={batch_size}.json")
# [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_resnet18_batchsize={... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- 概率与损失：交叉熵通常接收未归一化 logits；采样前按最后一维归一化并处理 temperature/top-k。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 160. 计算优化 | 5_addcmul.py

**学习问题。** torch.addcmul 如何融合逐元素表达式？

**中文讲解。** 它表达 input + value*tensor1*tensor2，减少 Python 循环和中间 tensor，通常由更少 kernel 完成。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/5_addcmul.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

x = torch.rand(3, 3)
# [变化示例] x=未定义/旧值 -> x=按 3, 3 创建的随机张量；shape 固定，具体值由 RNG 决定。
y = torch.rand(3, 3)
# [变化示例] y=未定义/旧值 -> y=按 3, 3 创建的随机张量；shape 固定，具体值由 RNG 决定。

z = x * y
# [变化示例] z=未定义/旧值 -> z=x * y；数值示例：2 * 3 -> 6。
z1 = z + x
# [变化示例] z1=未定义/旧值 -> z1=z + x；数值示例：2 + 3 -> 5。
print(z1)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 可以将上面的计算合并为一个算子，结果是等价的
z2 = torch.addcmul(x, x, y)
# [变化示例] z2=未定义/旧值 -> z2 接收 torch.addcmul(x, x, y) 的返回值；用 shape/dtype/device 与示例输入核对变化。
print(z2)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 161. 计算优化 | 6_addmm.py

**学习问题。** torch.addmm 如何融合 bias 与矩阵乘法？

**中文讲解。** addmm 表达 beta*input + alpha*(mat1@mat2)，可让后端在一次高效路径中处理 GEMM 与加法。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/6_addmm.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

a = torch.rand(4, 4)
# [变化示例] a=未定义/旧值 -> a=按 4, 4 创建的随机张量；shape 固定，具体值由 RNG 决定。
b = torch.rand(4, 4)
# [变化示例] b=未定义/旧值 -> b=按 4, 4 创建的随机张量；shape 固定，具体值由 RNG 决定。
c = torch.rand(4, 4)
# [变化示例] c=未定义/旧值 -> c=按 4, 4 创建的随机张量；shape 固定，具体值由 RNG 决定。

x = torch.matmul(a, b)
# [变化示例] x=未定义/旧值 -> x=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
x1 = x + c
# [变化示例] x1=未定义/旧值 -> x1=x + c；数值示例：2 + 3 -> 5。
print(x1)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。


# 融合成一个算子
x2 = torch.addmm(c, a, b)
# [变化示例] x2=未定义/旧值 -> x2 接收 torch.addmm(c, a, b) 的返回值；用 shape/dtype/device 与示例输入核对变化。
print(x2)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 162. 计算优化 | 7_fused_linear_bn.py

**学习问题。** 推理时如何融合 Linear 与 BatchNorm？

**中文讲解。** eval 模式下 BN 的 running mean/var 固定，可代数折叠进线性层权重和偏置；训练模式不能直接这样融合。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/7_fused_linear_bn.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
from torch.profiler import profile, ProfilerActivity


class SimpleModel(nn.Module):
    def __init__(self):
        super(SimpleModel, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleModel, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.linear = nn.Linear(100, 50)
        # [变化示例] self.linear=未定义/旧值 -> self.linear=线性映射模块；输入最后一维 100 -> 输出最后一维 50。
        self.bn = nn.BatchNorm1d(50)
        # [变化示例] self.bn=未定义/旧值 -> self.bn 接收 nn.BatchNorm1d(50) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    def forward(self, x):
        return self.bn(self.linear(x))
        # [变化示例] 函数内部：执行 self.bn(self.linear(x)) 得到结果 -> 调用方收到该输出。


@torch.no_grad()
def run(data, model, num_iters, name):
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for _ in range(num_iters):
            # [变化示例] 循环示例：range(num_iters) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            original_output = model(input_tensor)
            # [变化示例] original_output=未定义/旧值 -> original_output 接收 model(input_tensor) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    prof.export_chrome_trace(f"traces/PROF_cuda_{name}.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_cuda_{name}.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


model = SimpleModel().to(torch.device("cuda:0"))
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
model.eval()
# [变化示例] 模块模式：旧 train/eval 标志 -> 评估模式，影响 Dropout/BatchNorm。
input_tensor = torch.randn(4, 100, device="cuda:0")
# [变化示例] input_tensor=未定义/旧值 -> input_tensor=按 4, 100 创建的随机张量；shape 固定，具体值由 RNG 决定。

# 融合前
run(input_tensor, model, num_iters=20, name="no_fusion")
# [变化示例] 执行状态：调用 run(input_tensor, model, num_iters=20, name="no_fusion") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# 融合后
fused_model = torch.nn.utils.fusion.fuse_linear_bn_eval(model.linear, model.bn)
# [变化示例] fused_model=未定义/旧值 -> fused_model 接收 torch.nn.utils.fusion.fuse_linear_bn_eval(model.linear, mod... 的返回值；用 shape/dtype/device 与示例输入核对变化。
run(input_tensor, fused_model, num_iters=20, name="fusion")
# [变化示例] 执行状态：调用 run(input_tensor, fused_model, num_iters=20, name="fusion") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- 推理上下文：关闭 autograd 记录；inference_mode 进一步减少 view/version tracking。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 163. 计算优化 | 8_non_zero.py

**学习问题。** torch.nonzero 为什么可能引入同步？

**中文讲解。** 在 CUDA 上结果行数依赖设备数据，CPU 需要知道输出 shape 时可能触发同步；能用 mask 直接计算时应避免不必要索引提取。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/8_non_zero.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
from torch.profiler import profile, ProfilerActivity


class Model(torch.nn.Module):
    def __init__(self):
        super(Model, self).__init__()
        # [变化示例] 执行状态：调用 super(Model, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.linear1 = nn.Linear(1000, 5000)
        # [变化示例] self.linear1=未定义/旧值 -> self.linear1=线性映射模块；输入最后一维 1000 -> 输出最后一维 5000。
        self.linear2 = nn.Linear(5000, 10000)
        # [变化示例] self.linear2=未定义/旧值 -> self.linear2=线性映射模块；输入最后一维 5000 -> 输出最后一维 10000。
        self.linear3 = nn.Linear(10000, 10000)
        # [变化示例] self.linear3=未定义/旧值 -> self.linear3=线性映射模块；输入最后一维 10000 -> 输出最后一维 10000。
        self.relu = nn.ReLU()
        # [变化示例] self.relu=未定义/旧值 -> self.relu=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。

    def forward(self, x):
        output = self.relu(self.linear1(x))
        # [变化示例] output=未定义/旧值 -> output=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        output = self.relu(self.linear2(output))
        # [变化示例] output=未定义/旧值 -> output=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        output = self.relu(self.linear3(output))
        # [变化示例] output=未定义/旧值 -> output=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        nonzero = torch.nonzero(output)
        # [变化示例] nonzero=未定义/旧值 -> nonzero 接收 torch.nonzero(output) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return nonzero
        # [变化示例] 函数内部：nonzero；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


def run(data, model):
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for _ in range(10):
            # [变化示例] 循环示例：range(10) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            model(data)
            # [变化示例] 执行状态：调用 model(data) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    prof.export_chrome_trace("traces/PROF_nonzero.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace("traces/PROF_nonzero.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


data = torch.randn(1, 1000, device="cuda")
# [变化示例] data=未定义/旧值 -> data=按 1, 1000 创建的随机张量；shape 固定，具体值由 RNG 决定。
model = Model().to(torch.device("cuda"))
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
run(data, model)
# [变化示例] 执行状态：调用 run(data, model) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 164. 计算优化 | 9_tensor_on_cuda.py

**学习问题。** 为什么应直接在目标 device 创建张量？

**中文讲解。** 先在 CPU 创建再搬运会增加分配和 PCIe 传输；device 参数可让初始化直接发生在 GPU。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/9_tensor_on_cuda.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
from torch.profiler import profile, ProfilerActivity


def tensor_creation(num_iters, create_on_gpu):
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        shape = (10, 6400)
        # [变化示例] shape=未定义/旧值 -> shape=tuple (10, 6400)；多个值按位置传递/解包，元素本身不被复制。
        for i in range(num_iters):
            # [变化示例] 循环示例：range(num_iters) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            if create_on_gpu:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                data = torch.randn(shape, device="cuda")
                # [变化示例] data=未定义/旧值 -> data=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
            else:
                # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                data = torch.randn(shape).to("cuda")
                # [变化示例] data=未定义/旧值 -> data=按 shape).to("cuda" 创建的随机张量；shape 固定，具体值由 RNG 决定。
    prof.export_chrome_trace(
        f"traces/PROF_tensor_creation_on_gpu_{create_on_gpu}.json"
    )
    # [变化示例] 执行状态：调用 prof.export_chrome_trace( f"traces/PROF_tensor_creation_on_... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


# 情况1. 先在CPU上创建Tensor然后拷贝到GPU
tensor_creation(20, create_on_gpu=False)
# [变化示例] 执行状态：调用 tensor_creation(20, create_on_gpu=False) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# 情况2. 直接在GPU上创建Tensor
tensor_creation(20, create_on_gpu=True)
# [变化示例] 执行状态：调用 tensor_creation(20, create_on_gpu=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 165. 计算优化 | 10_inplace.py

**学习问题。** 原地算子一定更快更省内存吗？

**中文讲解。** 它可能减少一个输出分配，但会增加 autograd/version/别名约束；性能收益必须实测，不能牺牲正确性。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/10_inplace.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
from torch.profiler import profile, ProfilerActivity


def run(data, use_inplace):
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for i in range(2):
            # [变化示例] 循环示例：range(2) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            if use_inplace:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                data.mul_(2)
                # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 data.mul_(2) 后直接覆盖同一 storage。
            else:
                # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                output = data.mul(2)
                # [变化示例] output=未定义/旧值 -> output 接收 data.mul(2) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    prof.export_chrome_trace(f"traces/PROF_use_inplace_{use_inplace}.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_use_inplace_{use_inp... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


shape = (32, 32, 256, 256)
# [变化示例] shape=未定义/旧值 -> shape=tuple (32, 32, 256, 256)；多个值按位置传递/解包，元素本身不被复制。

# Non-Inplace
data1 = torch.randn(shape, device="cuda:0")
# [变化示例] data1=未定义/旧值 -> data1=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
run(data1, use_inplace=False)
# [变化示例] 执行状态：调用 run(data1, use_inplace=False) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# Inplace
data2 = torch.randn(shape, device="cuda:0")
# [变化示例] data2=未定义/旧值 -> data2=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
run(data2, use_inplace=True)
# [变化示例] 执行状态：调用 run(data2, use_inplace=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 166. 计算优化 | 11_inference_mode.py

**学习问题。** inference_mode 与 no_grad 有什么区别？

**中文讲解。** 两者都关闭反向记录；inference_mode 还省去更多 view/version tracking，适合确定只做推理的区域。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/11_inference_mode.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
import time


class SimpleCNN(nn.Module):
    def __init__(self):
        super(SimpleCNN, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleCNN, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, stride=1, padding=1)
        # [变化示例] self.conv1=未定义/旧值 -> self.conv1 接收 nn.Conv2d(3, 16, kernel_size=3, stride=1, padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.relu = nn.ReLU()
        # [变化示例] self.relu=未定义/旧值 -> self.relu=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1)
        # [变化示例] self.conv2=未定义/旧值 -> self.conv2 接收 nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    def forward(self, x):
        x = self.conv1(x)
        # [变化示例] x=未定义/旧值 -> x 接收 self.conv1(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = self.relu(x)
        # [变化示例] x=未定义/旧值 -> x=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        x = self.conv2(x)
        # [变化示例] x=未定义/旧值 -> x 接收 self.conv2(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return x
        # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


def infer(input_data, num_iters, use_inference_mode):
    start = time.perf_counter()
    # [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。

    with torch.inference_mode(mode=use_inference_mode):
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for _ in range(num_iters):
            # [变化示例] 循环示例：range(num_iters) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            output = model(input_data)
            # [变化示例] output=未定义/旧值 -> output 接收 model(input_data) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
    end = time.perf_counter()
    # [变化示例] end=未定义/旧值 -> end=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
    return (end - start) * 1000
    # [变化示例] 函数内部：(end - start) * 1000；数值示例：2 * 3 -> 6 -> 调用方收到该输出。


model = SimpleCNN().to(torch.device("cuda:0"))
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
input_data = torch.randn(1, 3, 224, 224, device="cuda:0")
# [变化示例] input_data=未定义/旧值 -> input_data=按 1, 3, 224, 224 创建的随机张量；shape 固定，具体值由 RNG 决定。

# 开启Inference Mode
infer(input_data, num_iters=10, use_inference_mode=True)  # warm up
runtime = infer(input_data, num_iters=100, use_inference_mode=True)
# [变化示例] runtime=未定义/旧值 -> runtime 接收 infer(input_data, num_iters=100, use_inference_mode=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
print(f"开启Inference Mode用时: {runtime}s")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 关闭Inference Mode
infer(input_data, num_iters=10, use_inference_mode=False)  # warm up
runtime = infer(input_data, num_iters=100, use_inference_mode=False)
# [变化示例] runtime=未定义/旧值 -> runtime 接收 infer(input_data, num_iters=100, use_inference_mode=False) 的返回值；用 shape/dtype/device 与示例输入核对变化。
print(f"关闭Inference Mode用时: {runtime}s")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- 推理上下文：关闭 autograd 记录；inference_mode 进一步减少 view/version tracking。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 167. 计算优化 | 12_copy_uint8.py

**学习问题。** 为什么压缩传输 dtype 可能提升拷贝速度？

**中文讲解。** 传输时间近似字节数除以带宽；uint8 比 float32 少 4 倍字节，但量化/反量化会引入计算和误差。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/12_copy_uint8.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
from torch.profiler import profile, ProfilerActivity


def data_copy(data, dtype_name=""):
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for _ in range(10):
            # [变化示例] 循环示例：range(10) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            output = data.to("cuda:0", non_blocking=False)
            # [变化示例] output=未定义/旧值 -> output 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    prof.export_chrome_trace(f"traces/PROF_data_copy_{dtype_name}.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_data_copy_{dtype_nam... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


# Float precision
data1 = torch.randn(4, 32, 32, 1024, dtype=torch.float32)
# [变化示例] data1=未定义/旧值 -> data1=按 4, 32, 32, 1024 创建的随机张量；shape 固定，具体值由 RNG 决定。
data_copy(data1, "float32")
# [变化示例] 执行状态：调用 data_copy(data1, "float32") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


# Uint8 precision
data2 = torch.randint(0, 255, (4, 32, 32, 1024), dtype=torch.uint8)
# [变化示例] data2=未定义/旧值 -> data2=指定整数区间的随机张量；例如 randint(0,10,(32,)) -> shape=(32,)，值均在 [0,10)。
data_copy(data2, "uint8")
# [变化示例] 执行状态：调用 data_copy(data2, "uint8") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- 异步传输与 stream：是否真正重叠取决于 pinned memory、stream 依赖和后续同步。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 168. 计算优化 | 13_sgd.py

**学习问题。** foreach 优化器如何减少 kernel launch？

**中文讲解。** foreach 把多个参数上的同类更新批量提交，降低 Python 与 kernel launch 开销，但可能使用额外临时内存。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/13_sgd.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
# 伪代码
for w in [w1, w2, ..., w10]:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    w = w - lr * w.grad
    # [变化示例] w=未定义/旧值 -> w=w - lr * w.grad；数值示例：3 - 2 -> 1。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 169. 计算优化 | 14_optim.py

**学习问题。** 如何公平比较优化器实现性能？

**中文讲解。** 固定参数规模、梯度、device、warmup 和同步方式，再比较 for-loop、foreach 或 fused 路径。 优化顺序应是先测量，再减少同步与数据搬运，随后做向量化、算子融合和批量化。

**来源文件。** `chapter_06_compute/14_optim.py`

#### 数学、性能模型与算法思路

$$
T\approx T_{launch}+\max\!\left(\frac{FLOPs}{P_{compute}},\frac{Bytes}{BW_{memory}}\right)
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
from torch.profiler import profile, ProfilerActivity


class SimpleNet(torch.nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleNet, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.fcs = torch.nn.ModuleList(torch.nn.Linear(200, 200) for i in range(20))
        # [变化示例] self.fcs=未定义/旧值 -> self.fcs 接收 torch.nn.ModuleList(torch.nn.Linear(200, 200) for i in rang... 的返回值；用 shape/dtype/device 与示例输入核对变化。

    def forward(self, x):
        for i in range(len(self.fcs)):
            # [变化示例] 循环示例：range(len(self.fcs) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            x = torch.relu(self.fcs[i](x))
            # [变化示例] x=未定义/旧值 -> x=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        return x
        # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


def train(net, optimizer, opt_name=""):
    data = torch.randn(64, 200, device="cuda:0")
    # [变化示例] data=未定义/旧值 -> data=按 64, 200 创建的随机张量；shape 固定，具体值由 RNG 决定。
    target = torch.randint(0, 1, (64,), device="cuda:0")
    # [变化示例] target=未定义/旧值 -> target=指定整数区间的随机张量；例如 randint(0,10,(32,)) -> shape=(32,)，值均在 [0,10)。
    criterion = torch.nn.CrossEntropyLoss()
    # [变化示例] criterion=未定义/旧值 -> criterion 接收 torch.nn.CrossEntropyLoss() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        for _ in range(5):
            # [变化示例] 循环示例：range(5) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            optimizer.zero_grad()
            # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
            output = net(data)
            # [变化示例] output=未定义/旧值 -> output 接收 net(data) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            loss = criterion(output, target)
            # [变化示例] loss=未定义/旧值 -> loss 接收 criterion(output, target) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            loss.backward()
            # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
            optimizer.step()
            # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
    prof.export_chrome_trace(f"traces/PROF_perf_{opt_name}.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"traces/PROF_perf_{opt_name}.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


# For-loop
net = SimpleNet().to(torch.device("cuda:0"))
# [变化示例] net=未定义/旧值 -> net 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
adam_for_loop = torch.optim.Adam(
    net.parameters(), lr=0.01, foreach=False, fused=False
)
# [变化示例] adam_for_loop=未定义/旧值 -> adam_for_loop=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
train(net, adam_for_loop, opt_name="for_loop")
# [变化示例] 执行状态：调用 train(net, adam_for_loop, opt_name="for_loop") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


# For-each
net = SimpleNet().to(torch.device("cuda:0"))
# [变化示例] net=未定义/旧值 -> net 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
adam_for_each = torch.optim.Adam(
    net.parameters(), lr=0.01, foreach=True, fused=False
)
# [变化示例] adam_for_each=未定义/旧值 -> adam_for_each=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
train(net, adam_for_each, opt_name="for_each")
# [变化示例] 执行状态：调用 train(net, adam_for_each, opt_name="for_each") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


# Fused
net = SimpleNet().to(torch.device("cuda:0"))
# [变化示例] net=未定义/旧值 -> net 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
adam_fused = torch.optim.Adam(net.parameters(), lr=0.01, foreach=False, fused=True)
# [变化示例] adam_fused=未定义/旧值 -> adam_fused=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
train(net, adam_fused, opt_name="fused")
# [变化示例] 执行状态：调用 train(net, adam_fused, opt_name="fused") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。
- 概率与损失：交叉熵通常接收未归一化 logits；采样前按最后一维归一化并处理 temperature/top-k。

#### 输入、输出与验证

- **验证方法。** 优化前后用相同输入核对 torch.testing.assert_close，再比较稳态延迟、吞吐、kernel 数和峰值显存。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 170. CUDA 内存生命周期 | 1_max_split.sh

**学习问题。** CUDA allocator 的 max_split_size_mb 解决什么问题？

**中文讲解。** 它影响 caching allocator 如何拆分大 block，可缓解特定碎片问题；不是通用降显存开关，需结合 memory summary 调参。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/1_max_split.sh`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
# [变化示例] 命令状态：执行 export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 171. CUDA 内存生命周期 | 1.5_allocated.py

**学习问题。** allocated 与 reserved 显存有什么区别？

**中文讲解。** allocated 是活跃 tensor 占用，reserved 是 caching allocator 从 CUDA 保留的内存池；两者差值不等于泄漏。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/1.5_allocated.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

t1 = torch.randn([1024, 1024], device="cuda:0")  # 4MB
# [变化示例] t1=未定义/旧值 -> t1=按 [1024, 1024] 创建的随机张量；shape 固定，具体值由 RNG 决定。

shape = [256, 1024, 1024, 1]  # 1024MB
# [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024, 1]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
t2 = torch.randn(shape, device="cuda:0")
# [变化示例] t2=未定义/旧值 -> t2=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。

print(
    f"PyTorch reserved {torch.cuda.memory_reserved()/1024/1024}MB, allocated {torch.cuda.memory_allocated()/1024/1024}MB"
)
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# PyTorch reserved 1044.0MB, allocated 1028.0MB
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 172. CUDA 内存生命周期 | 2_profiler.py

**学习问题。** 如何记录 CUDA 内存时间线？

**中文讲解。** memory profiler 把分配事件与调用栈关联，帮助区分参数、激活、梯度和临时 workspace 的峰值。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/2_profiler.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


with torch.inference_mode():
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    shape = [256, 1024, 1024, 1]
    # [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024, 1]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    x1 = torch.randn(shape, device="cuda:0")
    # [变化示例] x1=未定义/旧值 -> x1=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
    x2 = torch.randn(shape, device="cuda:0")
    # [变化示例] x2=未定义/旧值 -> x2=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。

    # Multiplication
    y = x1 * x2
    # [变化示例] y=未定义/旧值 -> y=x1 * x2；数值示例：2 * 3 -> 6。

torch.cuda.memory._dump_snapshot("traces/vram_profile_example.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("traces/vram_profile_examp... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 推理上下文：关闭 autograd 记录；inference_mode 进一步减少 view/version tracking。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 173. CUDA 内存生命周期 | 3_forward.py

**学习问题。** forward 与完整训练步骤分别保存哪些内存？

**中文讲解。** forward 为 backward 保存激活；完整训练还增加梯度、优化器状态和更新临时量，因此峰值通常更高。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/3_forward.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

with torch.inference_mode():
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    shape = [256, 1024, 1024, 1]
    # [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024, 1]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    weight = torch.randn(shape, device="cuda:0")  # (1)
    # [变化示例] weight=未定义/旧值 -> weight=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
    data = torch.randn(shape, device="cuda:0")  # (2)
    # [变化示例] data=未定义/旧值 -> data=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。

    x = data * weight  # (3)
    # [变化示例] x=未定义/旧值 -> x=data * weight；数值示例：2 * 3 -> 6。
    x = x * weight  # (4)
    # [变化示例] x=未定义/旧值 -> x=x * weight；数值示例：2 * 3 -> 6。
    x = x.sum()
    # [变化示例] x=未定义/旧值 -> x=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

torch.cuda.memory._dump_snapshot("traces/double_muls_inference.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("traces/double_muls_infere... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 推理上下文：关闭 autograd 记录；inference_mode 进一步减少 view/version tracking。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 174. CUDA 内存生命周期 | 4_full.py

**学习问题。** forward 与完整训练步骤分别保存哪些内存？

**中文讲解。** forward 为 backward 保存激活；完整训练还增加梯度、优化器状态和更新临时量，因此峰值通常更高。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/4_full.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.optim as optim


torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

shape = [256, 1024, 1024, 1]
# [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024, 1]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
weight = torch.randn(shape, requires_grad=True, device="cuda:0")
# [变化示例] weight=未定义/旧值 -> weight=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
data = torch.randn(shape, requires_grad=False, device="cuda:0")
# [变化示例] data=未定义/旧值 -> data=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。

x = data * weight
# [变化示例] x=未定义/旧值 -> x=data * weight；数值示例：2 * 3 -> 6。
x = x * weight
# [变化示例] x=未定义/旧值 -> x=x * weight；数值示例：2 * 3 -> 6。
x = x.sum()
# [变化示例] x=未定义/旧值 -> x=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

torch.cuda.memory._dump_snapshot("triple_muls_fwd.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("triple_muls_fwd.pickle") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

optimizer = optim.SGD([weight], lr=0.01)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
optimizer.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。

x.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

optimizer.step()
# [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

torch.cuda.memory._dump_snapshot("traces/double_muls_full.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("traces/double_muls_full.p... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 175. CUDA 内存生命周期 | 5_inplace.py

**学习问题。** 原地 Sigmoid 为什么可以少分配一个输出张量？

**中文讲解。** inference_mode 下 sigmoid_ 直接覆盖 x 的 storage，而 sigmoid 创建同 shape 新 tensor；示例用超大张量突出约 1 GiB 的分配差异。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/5_inplace.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

with torch.inference_mode():
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    shape = [256, 1024, 1024, 1]
    # [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024, 1]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    weight = torch.randn(shape, requires_grad=True, device="cuda:0")
    # [变化示例] weight=未定义/旧值 -> weight=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
    data = torch.randn(shape, requires_grad=False, device="cuda:0")
    # [变化示例] data=未定义/旧值 -> data=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。

    x = data * weight
    # [变化示例] x=未定义/旧值 -> x=data * weight；数值示例：2 * 3 -> 6。
    mem = torch.cuda.memory_allocated()
    # [变化示例] mem=未定义/旧值 -> mem=当前/峰值 CUDA 内存字节数；除以 1024^3 -> GiB。
    x.sigmoid_()
    # [变化示例] 执行状态：调用 x.sigmoid_() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    print(f"使用原位操作产生的显存占用: {torch.cuda.memory_allocated() - mem}GB")
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
    mem = torch.cuda.memory_allocated()
    # [变化示例] mem=未定义/旧值 -> mem=当前/峰值 CUDA 内存字节数；除以 1024^3 -> GiB。
    y = x.sigmoid()
    # [变化示例] y=未定义/旧值 -> y=逐元素 Sigmoid；例如 [-1,0,1] -> 约 [0.269,0.5,0.731]。
    print(
        f"不使用原位操作产生的显存占用: {(torch.cuda.memory_allocated() - mem)/1024/1024/1024}GB"
    )
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 使用原位操作产生的显存占用: 0GB
# 不使用原位操作产生的显存占用: 1.0GB
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 推理上下文：关闭 autograd 记录；inference_mode 进一步减少 view/version tracking。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 第一次 memory_allocated 差值没有除以 1024^3，却在文本中标为 GB；本例恰好为 0，通用写法仍应统一单位。

## 176. CUDA 内存生命周期 | 6_inplace_ad.py

**学习问题。** autograd 下原地计算为何要谨慎？

**中文讲解。** 即使数值上等价，backward 可能需要原值；version counter 和 saved tensor 会保护梯度正确性。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/6_inplace_ad.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.optim as optim

shape = [256, 1024, 1024, 1]
# [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024, 1]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
weight = torch.randn(shape, requires_grad=True, device="cuda:0")
# [变化示例] weight=未定义/旧值 -> weight=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
rand1 = torch.randn(shape, requires_grad=False, device="cuda:0")
# [变化示例] rand1=未定义/旧值 -> rand1=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。

x = rand1 * weight
# [变化示例] x=未定义/旧值 -> x=rand1 * weight；数值示例：2 * 3 -> 6。
x.sigmoid_()
# [变化示例] 执行状态：调用 x.sigmoid_() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
x.sigmoid_()
# [变化示例] 执行状态：调用 x.sigmoid_() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
x = x.sum()
# [变化示例] x=未定义/旧值 -> x=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

x.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

# 报错信息
# Variable._execution_engine.run_backward(  # Calls into the C++ engine to run the backward pass
# RuntimeError: one of the variables needed for gradient computation has been modified by an inplace operation:
#  [torch.cuda.FloatTensor [256, 1024, 1024, 1]], which is output 0 of SigmoidBackward0, is at version 2;
#  expected version 1 instead. Hint: enable anomaly detection to find the operation that failed to compute its gradient,
#  with torch.autograd.set_detect_anomaly(True).
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 177. CUDA 内存生命周期 | 7_sigmoid_bwd.py

**学习问题。** Sigmoid backward 需要保存什么？

**中文讲解。** 若已保存输出 y，导数可写成 y(1-y)，通常无需再次保存输入并重算 sigmoid。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/7_sigmoid_bwd.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
# Sigmoid算子
out = 1 / (1 + exp(-x))
# [变化示例] out=未定义/旧值 -> out=1 / (1 + exp(-x))；数值示例：6 / 3 -> 2。

# Sigmoid反向算子
dx = dout * out * (1 - out)
# [变化示例] dx=未定义/旧值 -> dx=dout * out * (1 - out)；数值示例：2 * 3 -> 6。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 178. CUDA 内存生命周期 | 8_assign.py

**学习问题。** 为什么 y = x 不会复制张量？

**中文讲解。** Python 赋值只让 y 与 x 指向同一个 Tensor 对象；随后 y.mul_ 原地修改共享 storage，所以从 x 也能观察到变化。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/8_assign.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

shape = [1, 4]
# [变化示例] shape=未定义/旧值 -> shape=[1, 4]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
x = torch.ones(shape)
# [变化示例] x=未定义/旧值 -> x=全 1 张量；例如 shape=(2,3) 时得到 6 个 1。
print("Initial x = ", x)  # Initial x =  tensor([[1., 1., 1., 1.]])
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

y = x
# [变化示例] y=未定义/旧值 -> y=x；这是一次重新绑定/状态更新，右侧值决定新状态。
y.mul_(10)
# [变化示例] 原地状态：目标 tensor=旧值 -> 执行 y.mul_(10) 后直接覆盖同一 storage。

print("Modified y = ", y)  # Modified y =  tensor([[10., 10., 10., 10.]])
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
print("Modified x = ", x)  # Modified x =  tensor([[10., 10., 10., 10.]])
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 179. CUDA 内存生命周期 | 9_view.py

**学习问题。** view 和基础切片为什么几乎不增加显存？

**中文讲解。** view(-1) 与 t[0] 只创建轻量 Tensor 元数据并共享 t 的 storage；修改 view 会反映到 base，主数据显存仍约 1 GiB。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/9_view.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch

shape = [256, 1024, 1024]
# [变化示例] shape=未定义/旧值 -> shape=[256, 1024, 1024]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
t = torch.ones(shape, device="cuda:0")
# [变化示例] t=未定义/旧值 -> t=全 1 张量；例如 shape=(2,3) 时得到 6 个 1。

print(f"Current memory used: {torch.cuda.memory_allocated()/1024/1024/1024}GB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# Current memory used: 1.0GB

v1 = t.view(-1)
# [变化示例] v1=未定义/旧值 -> v1 重排为 -1；元素数量与顺序保持不变（若布局允许则共享 storage）。
v1[0] = -1  # t[0][0][0]也被更新了
# [变化示例] 目标切片 v1[0]=旧值 -> -1；base tensor 对应位置同步被写入。
assert v1[0] == t[0][0][0] == -1
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
print(f"Current memory used: {torch.cuda.memory_allocated()/1024/1024/1024}GB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# Current memory used: 1.0GB


v2 = t[0]
# [变化示例] v2=未定义/旧值 -> v2=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
v2[0][1] = 2  # t[0][0][1]也被更新了
# [变化示例] 目标切片 v2[0][1]=旧值 -> 2；base tensor 对应位置同步被写入。
assert v2[0][1] == t[0][0][1] == 2
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
print(f"Current memory used: {torch.cuda.memory_allocated()/1024/1024/1024}GB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# Current memory used: 1.0GB
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 180. CUDA 内存生命周期 | 10_cross_batch.py

**学习问题。** 为什么跨 batch 保存带图 tensor 会导致显存增长？

**中文讲解。** Python 容器持有 loss/output 会同时持有整张 autograd 图；记录指标时应保存 item 或 detach 后的值。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/10_cross_batch.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.optim as optim

torch.manual_seed(1000)
# [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。

N = 128
# [变化示例] N=未定义/旧值 -> N=128；这是一次重新绑定/状态更新，右侧值决定新状态。
Total_N = 512
# [变化示例] Total_N=未定义/旧值 -> Total_N=512；这是一次重新绑定/状态更新，右侧值决定新状态。
dataset = torch.randn([Total_N, 32, 1024], requires_grad=False)
# [变化示例] dataset=未定义/旧值 -> dataset=按 [Total_N, 32, 1024] 创建的随机张量；shape 固定，具体值由 RNG 决定。

weight = torch.randn([1024, 32], requires_grad=True, device="cuda:0")
# [变化示例] weight=未定义/旧值 -> weight=按 [1024, 32] 创建的随机张量；shape 固定，具体值由 RNG 决定。
optimizer = optim.SGD([weight], lr=0.01)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。

num_iters = int(Total_N / 256)
# [变化示例] num_iters=未定义/旧值 -> num_iters 接收 int(Total_N / 256) 的返回值；用 shape/dtype/device 与示例输入核对变化。
steps = 2
# [变化示例] steps=未定义/旧值 -> steps=2；这是一次重新绑定/状态更新，右侧值决定新状态。

for i in range(num_iters):
    # [变化示例] 循环示例：range(num_iters) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
    # 模拟一个批次的训练
    optimizer.zero_grad()
    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。

    for j in range(steps):
        # [变化示例] 循环示例：range(steps) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        offset = i * 256 + N * j
        # [变化示例] offset=未定义/旧值 -> offset=i * 256 + N * j；数值示例：2 + 3 -> 5。

        input = dataset[offset : offset + N, :, :].to(torch.device("cuda:0"))
        # [变化示例] input=未定义/旧值 -> input 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        y = input.matmul(weight)
        # [变化示例] y=未定义/旧值 -> y 接收 input.matmul(weight) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        loss = y.sum()
        # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

        loss.backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
    optimizer.step()
    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

print(weight.sum())
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
print(f"显存分配的峰值: {torch.cuda.max_memory_allocated()/1024/1024}MB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 输出：
# tensor(2096.2283, device='cuda:0', grad_fn=<SumBackward0>)
# 显存分配的峰值: 49.00048828125MB
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 181. CUDA 内存生命周期 | 11_no_accumulation.py

**学习问题。** 怎样避免无意梯度累积？

**中文讲解。** PyTorch 默认把新梯度加到 param.grad；每个独立 step 前必须 zero_grad，除非明确做 gradient accumulation。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/11_no_accumulation.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.optim as optim

torch.manual_seed(1000)
# [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。

N = 256
# [变化示例] N=未定义/旧值 -> N=256；这是一次重新绑定/状态更新，右侧值决定新状态。
Total_N = 512
# [变化示例] Total_N=未定义/旧值 -> Total_N=512；这是一次重新绑定/状态更新，右侧值决定新状态。
dataset = torch.randn([Total_N, 32, 1024], requires_grad=False)
# [变化示例] dataset=未定义/旧值 -> dataset=按 [Total_N, 32, 1024] 创建的随机张量；shape 固定，具体值由 RNG 决定。

weight = torch.randn([1024, 32], requires_grad=True, device="cuda:0")
# [变化示例] weight=未定义/旧值 -> weight=按 [1024, 32] 创建的随机张量；shape 固定，具体值由 RNG 决定。
optimizer = optim.SGD([weight], lr=0.01)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。

num_iters = int(Total_N / 256)
# [变化示例] num_iters=未定义/旧值 -> num_iters 接收 int(Total_N / 256) 的返回值；用 shape/dtype/device 与示例输入核对变化。
for i in range(num_iters):
    # [变化示例] 循环示例：range(num_iters) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
    optimizer.zero_grad()
    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。

    offset = i * 256
    # [变化示例] offset=未定义/旧值 -> offset=i * 256；数值示例：2 * 3 -> 6。

    input = dataset[offset : offset + N, :, :].to(torch.device("cuda:0"))
    # [变化示例] input=未定义/旧值 -> input 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    y = input.matmul(weight)
    # [变化示例] y=未定义/旧值 -> y 接收 input.matmul(weight) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    loss = y.sum()
    # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

    loss.backward()
    # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
    optimizer.step()
    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

print(weight.sum())
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
print(f"显存分配的峰值: {torch.cuda.max_memory_allocated()/1024/1024}MB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 输出:
# tensor(2096.2275, device='cuda:0', grad_fn=<SumBackward0>)
# 显存分配的峰值: 81.37548828125MB
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 182. CUDA 内存生命周期 | 12_pow_model_checkpoint.py

**学习问题。** Gradient Checkpointing 如何用计算换显存？

**中文讲解。** 不保存选定段的中间激活，backward 时重算 forward；函数应可重放且不能依赖破坏性副作用。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/12_pow_model_checkpoint.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
from torch.utils.checkpoint import checkpoint_sequential

model = nn.Sequential(
    nn.Linear(1000, 40000),
    nn.ReLU(),
    nn.Linear(40000, 1000),
    nn.ReLU(),
    nn.Linear(1000, 5),
    nn.ReLU(),
).to("cuda")
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

input_var = torch.randn(10, 1000, device="cuda", requires_grad=True)
# [变化示例] input_var=未定义/旧值 -> input_var=按 10, 1000 创建的随机张量；shape 固定，具体值由 RNG 决定。

segments = 2
# [变化示例] segments=未定义/旧值 -> segments=2；这是一次重新绑定/状态更新，右侧值决定新状态。
modules = [module for k, module in model._modules.items()]
# [变化示例] modules=未定义/旧值 -> modules=[module for k, module in model._modules.items()]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

# (1). 使用checkpoint技术
out = checkpoint_sequential(modules, segments, input_var)
# [变化示例] out=未定义/旧值 -> out 接收 checkpoint_sequential(modules, segments, input_var) 的返回值；用 shape/dtype/device 与示例输入核对变化。

model.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
out.sum().backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
print(f"使用checkpoint技术显存分配峰值: {torch.cuda.max_memory_allocated()/1024/1024}MB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# 使用checkpoint技术显存分配峰值: 628.63671875MB

out_checkpointed = out.data.clone()
# [变化示例] out_checkpointed=未定义/旧值 -> out_checkpointed=独立副本；数值相同，但后续原地修改不再共享同一 storage。
grad_checkpointed = {}
# [变化示例] grad_checkpointed=未定义/旧值 -> grad_checkpointed={}；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
for name, param in model.named_parameters():
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    grad_checkpointed[name] = param.grad.data.clone()
    # [变化示例] grad_checkpointed[name]=未定义/旧值 -> grad_checkpointed[name]=独立副本；数值相同，但后续原地修改不再共享同一 storage。

# (2). 不使用checkpoint技术
original = model
# [变化示例] original=未定义/旧值 -> original=model；这是一次重新绑定/状态更新，右侧值决定新状态。
x = input_var.clone().detach_()
# [变化示例] x=未定义/旧值 -> x=独立副本；数值相同，但后续原地修改不再共享同一 storage。
out = original(x)
# [变化示例] out=未定义/旧值 -> out 接收 original(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

out_not_checkpointed = out.data.clone()
# [变化示例] out_not_checkpointed=未定义/旧值 -> out_not_checkpointed=独立副本；数值相同，但后续原地修改不再共享同一 storage。

original.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
out.sum().backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
print(f"不使用checkpoint技术显存分配峰值: {torch.cuda.max_memory_allocated()/1024/1024}MB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# 不使用checkpoint技术显存分配峰值: 936.17431640625MB

grad_not_checkpointed = {}
# [变化示例] grad_not_checkpointed=未定义/旧值 -> grad_not_checkpointed={}；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
for name, param in model.named_parameters():
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    grad_not_checkpointed[name] = param.grad.data.clone()
    # [变化示例] grad_not_checkpointed[name]=未定义/旧值 -> grad_not_checkpointed[name]=独立副本；数值相同，但后续原地修改不再共享同一 storage。


# 对比使用和不使用checkpoint技术计算出来的梯度都是一样的
assert torch.allclose(out_checkpointed, out_not_checkpointed)
# [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
for name in grad_checkpointed:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    assert torch.allclose(grad_checkpointed[name], grad_not_checkpointed[name])
    # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 183. CUDA 内存生命周期 | 13_offloading.py

**学习问题。** CPU offload 的核心权衡是什么？

**中文讲解。** 把参数、激活或优化器状态移到 CPU 可降低显存，但 PCIe/NVLink 传输可能成为新瓶颈。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/13_offloading.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn


class LargeModel(nn.Module):
    def __init__(self):
        super(LargeModel, self).__init__()
        # [变化示例] 执行状态：调用 super(LargeModel, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.layer1 = nn.Linear(50000, 50000)
        # [变化示例] self.layer1=未定义/旧值 -> self.layer1=线性映射模块；输入最后一维 50000 -> 输出最后一维 50000。
        self.layer2 = nn.Linear(50000, 50000)
        # [变化示例] self.layer2=未定义/旧值 -> self.layer2=线性映射模块；输入最后一维 50000 -> 输出最后一维 50000。

    # OOM on a GPU with 24GB
    # def forward(self, x):
    #     x = self.layer1(x)
    #     x = torch.relu(x)
    #     x = self.layer2(x)
    #     x = torch.relu(x)
    #     return x

    def forward(self, x):
        self.layer1.to("cuda")
        # [变化示例] 执行状态：调用 self.layer1.to("cuda") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        x = self.layer1(x)
        # [变化示例] x=未定义/旧值 -> x 接收 self.layer1(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = torch.relu(x)
        # [变化示例] x=未定义/旧值 -> x=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        self.layer1.to("cpu")
        # [变化示例] 执行状态：调用 self.layer1.to("cpu") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

        self.layer2.to("cuda")
        # [变化示例] 执行状态：调用 self.layer2.to("cuda") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        x = self.layer2(x)
        # [变化示例] x=未定义/旧值 -> x 接收 self.layer2(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = torch.relu(x)
        # [变化示例] x=未定义/旧值 -> x=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        self.layer2.to("cpu")
        # [变化示例] 执行状态：调用 self.layer2.to("cpu") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        return x
        # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


model = LargeModel().to("cuda")
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
input_data = torch.randn(10, 50000).to("cuda")
# [变化示例] input_data=未定义/旧值 -> input_data=按 10, 50000).to("cuda" 创建的随机张量；shape 固定，具体值由 RNG 决定。
output = model(input_data)
# [变化示例] output=未定义/旧值 -> output 接收 model(input_data) 的返回值；用 shape/dtype/device 与示例输入核对变化。

print(f"前向过程中GPU显存占用峰值: {torch.cuda.max_memory_allocated()/1024/1024/1024}GB")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# 前向过程中GPU显存占用峰值: 9.328798770904541GB

loss = output.sum()
# [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。
loss.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 184. CUDA 内存生命周期 | 14_adam_update_weight.py

**学习问题。** Adam 参数更新为什么会产生额外峰值？

**中文讲解。** 除 m/v 状态外，表达式求值还可能创建临时 tensor；no_grad、原地或 foreach/fused 路径可减少临时分配。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/14_adam_update_weight.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.optim as optim


# 模拟模型参数
def generate_params(device, shape):
    params = [
        torch.rand(shape, dtype=torch.float32, requires_grad=True, device=device)
        for _ in range(6)
    ]
    # [变化示例] params=未定义/旧值 -> params=[ torch.rand(shape, dtype=torch.float32, requires_grad=True...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    return params
    # [变化示例] 函数内部：params；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


# 模拟模型运行
def run(params):
    x = torch.rand(shape, dtype=torch.float32, device=device)
    # [变化示例] x=未定义/旧值 -> x=按 shape 创建的随机张量；shape 固定，具体值由 RNG 决定。
    x = params[0] * x
    # [变化示例] x=未定义/旧值 -> x=params[0] * x；数值示例：2 * 3 -> 6。
    x = params[1] * x
    # [变化示例] x=未定义/旧值 -> x=params[1] * x；数值示例：2 * 3 -> 6。
    x = params[2] * x
    # [变化示例] x=未定义/旧值 -> x=params[2] * x；数值示例：2 * 3 -> 6。
    x = params[3] * x
    # [变化示例] x=未定义/旧值 -> x=params[3] * x；数值示例：2 * 3 -> 6。
    x = params[4] * x
    # [变化示例] x=未定义/旧值 -> x=params[4] * x；数值示例：2 * 3 -> 6。
    x = params[5] * x
    # [变化示例] x=未定义/旧值 -> x=params[5] * x；数值示例：2 * 3 -> 6。
    x = x.sum()
    # [变化示例] x=未定义/旧值 -> x=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。
    return x
    # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


# (1) 使用for-each进行参数更新
torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
device = "cuda:0"
# [变化示例] device=未定义/旧值 -> device="cuda:0"；这是一次重新绑定/状态更新，右侧值决定新状态。
shape = [4]
# [变化示例] shape=未定义/旧值 -> shape=[4]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
params = generate_params(device, shape)
# [变化示例] params=未定义/旧值 -> params 接收 generate_params(device, shape) 的返回值；用 shape/dtype/device 与示例输入核对变化。
out = run(params)
# [变化示例] out=未定义/旧值 -> out 接收 run(params) 的返回值；用 shape/dtype/device 与示例输入核对变化。

optimizer = optim.Adam(params, lr=0.01, foreach=True)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
optimizer.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。

out.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
optimizer.step()
# [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

torch.cuda.memory._dump_snapshot("traces/adam_foreach.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("traces/adam_foreach.pickle") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

# (2) 使用for-loop进行参数更新
torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

device = "cuda:0"
# [变化示例] device=未定义/旧值 -> device="cuda:0"；这是一次重新绑定/状态更新，右侧值决定新状态。
shape = [4]
# [变化示例] shape=未定义/旧值 -> shape=[4]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
params = generate_params(device, shape)
# [变化示例] params=未定义/旧值 -> params 接收 generate_params(device, shape) 的返回值；用 shape/dtype/device 与示例输入核对变化。
out = run(params)
# [变化示例] out=未定义/旧值 -> out 接收 run(params) 的返回值；用 shape/dtype/device 与示例输入核对变化。

optimizer = optim.Adam(params, lr=0.01, foreach=False)
# [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
optimizer.zero_grad()
# [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。

out.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
optimizer.step()
# [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

torch.cuda.memory._dump_snapshot("traces/adam_forloop.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("traces/adam_forloop.pickle") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 185. CUDA 内存生命周期 | 15_adam_remove_grad.py

**学习问题。** 把 grad 设为 None 为什么可能更省内存？

**中文讲解。** set_to_none=True 允许释放旧梯度 storage，并让下次 backward 直接赋值而不是先清零再累加。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/15_adam_remove_grad.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
torch.cuda.memory._record_memory_history()
# [变化示例] 执行状态：调用 torch.cuda.memory._record_memory_history() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

device = "cuda:0"
# [变化示例] device=未定义/旧值 -> device="cuda:0"；这是一次重新绑定/状态更新，右侧值决定新状态。
shape = [4]
# [变化示例] shape=未定义/旧值 -> shape=[4]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
params = generate_params(device, shape)
# [变化示例] params=未定义/旧值 -> params 接收 generate_params(device, shape) 的返回值；用 shape/dtype/device 与示例输入核对变化。
out = run(params)
# [变化示例] out=未定义/旧值 -> out 接收 run(params) 的返回值；用 shape/dtype/device 与示例输入核对变化。

# 设置一个优化器字典，方便后续引用
optimizer_dict = {
    p: torch.optim.Adam([p], foreach=False) for p in [w0, w1, w2, w3, w4, w5]
}
# [变化示例] optimizer_dict=未定义/旧值 -> optimizer_dict={ p: torch.optim.Adam([p], foreach=False) for p in [w0, w1,...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。


# 定义一个优化器钩子，这个钩子会调用step()和zero_grad()函数
def optimizer_hook(parameter) -> None:
    optimizer_dict[parameter].step()
    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
    optimizer_dict[parameter].zero_grad()
    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。


# 设置钩子在梯度更新后被调用
for p in model.parameters():
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    p.register_post_accumulate_grad_hook(optimizer_hook)
    # [变化示例] 执行状态：调用 p.register_post_accumulate_grad_hook(optimizer_hook) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

out.backward()
# [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

torch.cuda.memory._dump_snapshot("traces/adam_remove_grad.pickle")
# [变化示例] 执行状态：调用 torch.cuda.memory._dump_snapshot("traces/adam_remove_grad.p... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 186. CUDA 内存生命周期 | 16_python_gc.py

**学习问题。** Python GC 与 CUDA tensor 释放是什么关系？

**中文讲解。** tensor 的 Python 引用归零后 storage 才可回到 caching allocator；循环引用需 GC 介入，但 reserved 显存可能仍保留。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/16_python_gc.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import gc


class Module1(torch.nn.Module):
    def __init__(self):
        super(Module1, self).__init__()
        # [变化示例] 执行状态：调用 super(Module1, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.saved = Module2(self)  # Module1对象保存了对Module2对象的引用
        # [变化示例] self.saved=未定义/旧值 -> self.saved 接收 Module2(self) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.tensor = torch.randn(1024, 1024, device="cuda")
        # [变化示例] self.tensor=未定义/旧值 -> self.tensor=按 1024, 1024 创建的随机张量；shape 固定，具体值由 RNG 决定。


class Module2(torch.nn.Module):
    def __init__(self, module):
        super(Module2, self).__init__()
        # [变化示例] 执行状态：调用 super(Module2, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.saved = module  # Module2对象也保存了对Module1对象的饮用
        # [变化示例] self.saved=未定义/旧值 -> self.saved=module；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.tensor = torch.randn(1024, 1024, device="cuda")
        # [变化示例] self.tensor=未定义/旧值 -> self.tensor=按 1024, 1024 创建的随机张量；shape 固定，具体值由 RNG 决定。


net = Module1()
# [变化示例] net=未定义/旧值 -> net=Module1()；这是一次重新绑定/状态更新，右侧值决定新状态。
print("Memory allocated: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

del net
# [变化示例] 引用状态：变量持有对象 -> 删除该引用；仅当无其他引用时，对象才可回收。
print("Memory allocated after delete: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

gc.collect()
# [变化示例] 执行状态：调用 gc.collect() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
print("Memory allocated after gc: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 187. CUDA 内存生命周期 | 17_gc_result.sh

**学习问题。** Python GC 与 CUDA tensor 释放是什么关系？

**中文讲解。** tensor 的 Python 引用归零后 storage 才可回到 caching allocator；循环引用需 GC 介入，但 reserved 显存可能仍保留。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/17_gc_result.sh`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
Memory allocated:  8388608
# [变化示例] 命令状态：执行 Memory allocated: 8388608 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
Memory allocated after delete:  8388608
# [变化示例] 命令状态：执行 Memory allocated after delete: 8388608 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
Memory allocated after gc:  0
# [变化示例] 命令状态：执行 Memory allocated after gc: 0 前 -> 得到命令输出或系统状态变化；以退出码判断成功。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 188. CUDA 内存生命周期 | 18_cycle.py

**学习问题。** 循环引用如何延迟 tensor 回收？

**中文讲解。** 对象彼此引用时引用计数不会立即归零，直到 cyclic GC 发现不可达环；其中的 CUDA tensor 会延迟释放。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/18_cycle.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch


class CustomLayer(torch.nn.Module):
    def __init__(self, model):
        super(CustomLayer, self).__init__()
        # [变化示例] 执行状态：调用 super(CustomLayer, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.model = model
        # [变化示例] self.model=未定义/旧值 -> self.model=model；这是一次重新绑定/状态更新，右侧值决定新状态。


class MyModel(torch.nn.Module):
    def __init__(self):
        super(MyModel, self).__init__()
        # [变化示例] 执行状态：调用 super(MyModel, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.custom_layer = CustomLayer(self)
        # [变化示例] self.custom_layer=未定义/旧值 -> self.custom_layer 接收 CustomLayer(self) 的返回值；用 shape/dtype/device 与示例输入核对变化。


model = MyModel()
# [变化示例] model=未定义/旧值 -> model=MyModel()；这是一次重新绑定/状态更新，右侧值决定新状态。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 189. CUDA 内存生命周期 | 19_local_var.py

**学习问题。** 变量作用域和 del 如何影响显存生命周期？

**中文讲解。** 局部变量在作用域结束后通常可释放；全局或容器引用会延长生命周期，del 只删除一个引用而非强制清空 allocator。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/19_local_var.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch


def func():
    tensors = []
    # [变化示例] tensors=未定义/旧值 -> tensors=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    for _ in range(100):
        # [变化示例] 循环示例：range(100) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        tensors.append(torch.randn(100, 100, device="cuda"))
        # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。

    print("Memory allocated from function: ", torch.cuda.memory_allocated(0))
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
    return
    # [变化示例] 函数内部： -> 调用方收到该输出。


func()
# [变化示例] 执行状态：调用 func() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
print("Memory allocated: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 输出:
# Memory allocated from function:  4044800
# Memory allocated:  0
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 190. CUDA 内存生命周期 | 20_global_var.py

**学习问题。** 变量作用域和 del 如何影响显存生命周期？

**中文讲解。** 局部变量在作用域结束后通常可释放；全局或容器引用会延长生命周期，del 只删除一个引用而非强制清空 allocator。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/20_global_var.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import time
import random


def train():
    global input
    input = torch.randn(100, 100, device="cuda")
    # [变化示例] input=未定义/旧值 -> input=按 100, 100 创建的随机张量；shape 固定，具体值由 RNG 决定。


train()
# [变化示例] 执行状态：调用 train() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
print("Memory allocated for input: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

tensors = []
# [变化示例] tensors=未定义/旧值 -> tensors=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
for _ in range(100):
    # [变化示例] 循环示例：range(100) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
    tensors.append(torch.randn(100, 100, device="cuda"))
    # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
print("Memory allocated for tensors & input: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# time.sleep(1000000000000) 不管睡多久都不会释放的
# for i in range(100000000000): new_var = random.randint() 通过分配新变量触发垃圾回收，也不会清理的

print("Memory allocated total: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。


# 输出
# Memory allocated for input:  40448
# Memory allocated for tensors & input:  4085248
# Memory allocated total:  4085248
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 191. CUDA 内存生命周期 | 21_manual_del.py

**学习问题。** 变量作用域和 del 如何影响显存生命周期？

**中文讲解。** 局部变量在作用域结束后通常可释放；全局或容器引用会延长生命周期，del 只删除一个引用而非强制清空 allocator。 区分 allocated、reserved、峰值激活、梯度和优化器状态，并理解 Python 引用如何决定张量何时可释放。

**来源文件。** `chapter_07_memory/21_manual_del.py`

#### 数学、性能模型与算法思路

$$
M_{peak}\approx M_{param}+M_{grad}+M_{optim}+M_{activation}+M_{temp}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
del tensors
# [变化示例] 引用状态：变量持有对象 -> 删除该引用；仅当无其他引用时，对象才可回收。
del input
# [变化示例] 引用状态：变量持有对象 -> 删除该引用；仅当无其他引用时，对象才可回收。
print("Memory allocated after cleaning: ", torch.cuda.memory_allocated(0))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
# Memory allocated after cleaning: 0
```

#### 代码/API 逐项解释

- CUDA 内存 API：区分活跃分配与 allocator 保留；empty_cache 不会释放仍被 tensor 引用的内存。

#### 输入、输出与验证

- **验证方法。** 在关键阶段记录 memory_allocated/max_memory_allocated，并用引用生命周期解释峰值；不要把 reserved 直接称为泄漏。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 192. 分布式训练与 DDP | 1_single_gpu.py

**学习问题。** 单 GPU 基线为何是分布式优化的前提？

**中文讲解。** 先固定单卡数值和性能基线，才能判断 DDP 的正确性、缩放效率和通信开销。 数据并行的核心是各 rank 独立前向反向，再通过 collective 同步梯度并保持参数一致。

**来源文件。** `chapter_08_distributed/1_single_gpu.py`

#### 数学、性能模型与算法思路

$$
g=\frac{1}{W}\sum_{r=1}^{W}g_r,\qquad efficiency=\frac{T_1}{W\,T_W}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from common import SimpleNet, MyTrainDataset


def train(model, optimizer, train_data, device_id):
    model = model.to(device_id)
    # [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
    for i, (src, target) in enumerate(train_data):
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        src = src.to(device_id)
        # [变化示例] src=未定义/旧值 -> src 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        target = target.to(device_id)
        # [变化示例] target=未定义/旧值 -> target 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        optimizer.zero_grad()
        # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
        output = model(src)
        # [变化示例] output=未定义/旧值 -> output 接收 model(src) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        loss = F.mse_loss(output, target)
        # [变化示例] loss=未定义/旧值 -> loss=均方误差；例如 prediction=[1,3]、target=[1,1] -> mean([0,4])=2。
        loss.backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
        optimizer.step()
        # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
        print(f"[GPU{device_id}]: batch {i}/{len(train_data)}, loss: {loss}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。


def main(device_id):
    model = SimpleNet()
    # [变化示例] model=未定义/旧值 -> model=SimpleNet()；这是一次重新绑定/状态更新，右侧值决定新状态。

    optimizer = torch.optim.SGD(model.parameters(), lr=1e-2)
    # [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。

    batchsize_per_gpu = 32
    # [变化示例] batchsize_per_gpu=未定义/旧值 -> batchsize_per_gpu=32；这是一次重新绑定/状态更新，右侧值决定新状态。
    dataset = MyTrainDataset(num=2048, size=512)
    # [变化示例] dataset=未定义/旧值 -> dataset 接收 MyTrainDataset(num=2048, size=512) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    train_data = DataLoader(dataset, batch_size=batchsize_per_gpu)
    # [变化示例] train_data=未定义/旧值 -> train_data=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。

    train(model, optimizer, train_data, device_id)
    # [变化示例] 执行状态：调用 train(model, optimizer, train_data, device_id) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    device_id = 0
    # [变化示例] device_id=未定义/旧值 -> device_id=0；这是一次重新绑定/状态更新，右侧值决定新状态。
    main(device_id)
    # [变化示例] 执行状态：调用 main(device_id) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 检查每个 rank 的参数初值、样本划分和 collective 顺序；一步更新后与单卡等效大 batch 结果做容差比较。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 193. 分布式训练与 DDP | 2_hook.py

**学习问题。** autograd hook 如何观察或修改梯度？

**中文讲解。** hook 在梯度产生时被调用，可用于日志、压缩或调试；修改梯度必须保持 shape/device/dtype 合法。 数据并行的核心是各 rank 独立前向反向，再通过 collective 同步梯度并保持参数一致。

**来源文件。** `chapter_08_distributed/2_hook.py`

#### 数学、性能模型与算法思路

$$
g=\frac{1}{W}\sum_{r=1}^{W}g_r,\qquad efficiency=\frac{T_1}{W\,T_W}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
from torch.distributed.algorithms.ddp_comm_hooks.debugging_hooks import noop_hook

model.register_comm_hook(None, noop_hook)
# [变化示例] 执行状态：调用 model.register_comm_hook(None, noop_hook) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 分布式 collective：所有 rank 必须以一致顺序参与；梯度求和后是否除 world_size 要与损失缩放约定一致。

#### 输入、输出与验证

- **验证方法。** 检查每个 rank 的参数初值、样本划分和 collective 顺序；一步更新后与单卡等效大 batch 结果做容差比较。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 194. 分布式训练与 DDP | common.py

**学习问题。** 分布式实验的公共初始化应包含什么？

**中文讲解。** 统一模型、数据、优化器、随机种子和进程组配置，避免把初始化差异误判为 DDP 数值问题。 数据并行的核心是各 rank 独立前向反向，再通过 collective 同步梯度并保持参数一致。

**来源文件。** `chapter_08_distributed/common.py`

#### 数学、性能模型与算法思路

$$
g=\frac{1}{W}\sum_{r=1}^{W}g_r,\qquad efficiency=\frac{T_1}{W\,T_W}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
from torch.utils.data import Dataset


def set_seed(seed: int = 37) -> None:
# [变化示例] 调用该单行函数时：int=未定义/旧值 -> int=37) -> None:；这是一次重新绑定/状态更新，右侧值决定新状态。
    torch.manual_seed(seed)
    # [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。
    torch.cuda.manual_seed(seed)
    # [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。
    torch.backends.cudnn.deterministic = True
    # [变化示例] torch.backends.cudnn.deterministic=未定义/旧值 -> torch.backends.cudnn.deterministic=True；这是一次重新绑定/状态更新，右侧值决定新状态。
    torch.backends.cudnn.benchmark = False
    # [变化示例] torch.backends.cudnn.benchmark=未定义/旧值 -> torch.backends.cudnn.benchmark=False；这是一次重新绑定/状态更新，右侧值决定新状态。


set_seed(1234)
# [变化示例] 执行状态：调用 set_seed(1234) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


class MyTrainDataset(Dataset):
    def __init__(self, num, size):
        self.num = num
        # [变化示例] self.num=未定义/旧值 -> self.num=num；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.data = [
            (
                torch.rand(size, dtype=torch.float),
                torch.tensor([i / num], dtype=torch.float),
            )
            for i in range(num)
        ]
        # [变化示例] self.data=未定义/旧值 -> self.data=[ ( torch.rand(size, dtype=torch.float), torch.tensor([i / ...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

    def __len__(self):
        return self.num
        # [变化示例] 函数内部：self.num；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def __getitem__(self, index):
        return self.data[index]
        # [变化示例] 函数内部：索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,) -> 调用方收到该输出。


class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleNet, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.fc1 = nn.Linear(512, 10240, bias=True)
        # [变化示例] self.fc1=未定义/旧值 -> self.fc1=线性映射模块；输入最后一维 512 -> 输出最后一维 10240。
        self.fc2 = nn.Linear(10240, 10240, bias=True)
        # [变化示例] self.fc2=未定义/旧值 -> self.fc2=线性映射模块；输入最后一维 10240 -> 输出最后一维 10240。
        self.fc3 = nn.Linear(10240, 1, bias=True)
        # [变化示例] self.fc3=未定义/旧值 -> self.fc3=线性映射模块；输入最后一维 10240 -> 输出最后一维 1。

    def forward(self, x):
        out = self.fc1(x)
        # [变化示例] out=未定义/旧值 -> out 接收 self.fc1(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        out = self.fc2(out)
        # [变化示例] out=未定义/旧值 -> out 接收 self.fc2(out) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        out = self.fc3(out)
        # [变化示例] out=未定义/旧值 -> out 接收 self.fc3(out) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return out
        # [变化示例] 函数内部：out；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 检查每个 rank 的参数初值、样本划分和 collective 顺序；一步更新后与单卡等效大 batch 结果做容差比较。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 195. 分布式训练与 DDP | manual_ddp.py

**学习问题。** 手写数据并行需要哪些步骤？

**中文讲解。** 每个 rank 处理不同数据，backward 后对每个梯度 all_reduce 并除 world_size，再执行相同优化器更新。 数据并行的核心是各 rank 独立前向反向，再通过 collective 同步梯度并保持参数一致。

**来源文件。** `chapter_08_distributed/manual_ddp.py`

#### 数学、性能模型与算法思路

$$
g=\frac{1}{W}\sum_{r=1}^{W}g_r,\qquad efficiency=\frac{T_1}{W\,T_W}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from common import SimpleNet, MyTrainDataset

import os
import torch.distributed as dist
import torch.multiprocessing as mp


# (3) 初始化分布式通信组
def setup(rank, device_id, world_size, backend):
    os.environ["MASTER_ADDR"] = "127.0.0.1"
    # [变化示例] 目标切片 os.environ["MASTER_ADDR"]=旧值 -> "127.0.0.1"；base tensor 对应位置同步被写入。
    os.environ["MASTER_PORT"] = "29500"
    # [变化示例] 目标切片 os.environ["MASTER_PORT"]=旧值 -> "29500"；base tensor 对应位置同步被写入。
    dist.init_process_group(backend, rank=rank, world_size=world_size)
    # [变化示例] 执行状态：调用 dist.init_process_group(backend, rank=rank, world_size=worl... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    torch.cuda.set_device(device_id)
    # [变化示例] 执行状态：调用 torch.cuda.set_device(device_id) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


def train(model, optimizer, train_data, rank, device_id, world_size):
    for i, (src, target) in enumerate(train_data):
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        src = src.to(device_id)
        # [变化示例] src=未定义/旧值 -> src 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        target = target.to(device_id)
        # [变化示例] target=未定义/旧值 -> target 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        optimizer.zero_grad()
        # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
        output = model(src)
        # [变化示例] output=未定义/旧值 -> output 接收 model(src) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        loss = F.mse_loss(output, target)
        # [变化示例] loss=未定义/旧值 -> loss=均方误差；例如 prediction=[1,3]、target=[1,1] -> mean([0,4])=2。
        loss.backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

        # (5) 每个批次训练结束后进行梯度同步
        grads = [t.grad.data for t in model.parameters()]
        # [变化示例] grads=未定义/旧值 -> grads=[t.grad.data for t in model.parameters()]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for grad in grads:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            grad.div_(world_size)
            # [变化示例] 执行状态：调用 grad.div_(world_size) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
            dist.all_reduce(grad, op=dist.ReduceOp.SUM)
            # [变化示例] 执行状态：调用 dist.all_reduce(grad, op=dist.ReduceOp.SUM) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

        optimizer.step()
        # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
        print(f"[GPU{rank}]: batch {i}/{len(train_data)}, loss: {loss}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。


def main(rank, world_size, backend):
    device_id = rank
    # [变化示例] device_id=未定义/旧值 -> device_id=rank；这是一次重新绑定/状态更新，右侧值决定新状态。
    setup(rank, device_id, world_size, backend)
    # [变化示例] 执行状态：调用 setup(rank, device_id, world_size, backend) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    model = SimpleNet().to(device_id)
    # [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

    # (4) 初始化模型并参数同步
    params = [t.detach() for t in model.parameters()]
    # [变化示例] params=未定义/旧值 -> params=[t.detach() for t in model.parameters()]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    for param in params:
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        dist.broadcast(param, 0)
        # [变化示例] 执行状态：调用 dist.broadcast(param, 0) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    optimizer = torch.optim.SGD(model.parameters(), lr=1e-2)
    # [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。

    batchsize_per_gpu = 4096
    # [变化示例] batchsize_per_gpu=未定义/旧值 -> batchsize_per_gpu=4096；这是一次重新绑定/状态更新，右侧值决定新状态。
    dataset = MyTrainDataset(num=40960, size=512)
    # [变化示例] dataset=未定义/旧值 -> dataset 接收 MyTrainDataset(num=40960, size=512) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # (1) 数据分割
    sampler = torch.utils.data.distributed.DistributedSampler(
        dataset, num_replicas=world_size, rank=rank
    )
    # [变化示例] sampler=未定义/旧值 -> sampler 接收 torch.utils.data.distributed.DistributedSampler( dataset, n... 的返回值；用 shape/dtype/device 与示例输入核对变化。
    train_data = DataLoader(dataset, batch_size=batchsize_per_gpu, sampler=sampler)
    # [变化示例] train_data=未定义/旧值 -> train_data=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。

    train(model, optimizer, train_data, rank, device_id, world_size)
    # [变化示例] 执行状态：调用 train(model, optimizer, train_data, rank, device_id, world_... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    # (2) 多进程启动和管理
    world_size = 2
    # [变化示例] world_size=未定义/旧值 -> world_size=2；这是一次重新绑定/状态更新，右侧值决定新状态。
    mp.spawn(main, args=(world_size, "nccl"), nprocs=world_size, join=True)
    # [变化示例] 执行状态：调用 mp.spawn(main, args=(world_size, "nccl"), nprocs=world_size... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- 分布式 collective：所有 rank 必须以一致顺序参与；梯度求和后是否除 world_size 要与损失缩放约定一致。

#### 输入、输出与验证

- **验证方法。** 检查每个 rank 的参数初值、样本划分和 collective 顺序；一步更新后与单卡等效大 batch 结果做容差比较。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 196. 分布式训练与 DDP | torch_ddp.py

**学习问题。** DistributedDataParallel 自动做了什么？

**中文讲解。** DDP 在参数上注册 autograd hook，把梯度按 bucket 异步 all-reduce，并尽量与反向计算重叠。 数据并行的核心是各 rank 独立前向反向，再通过 collective 同步梯度并保持参数一致。

**来源文件。** `chapter_08_distributed/torch_ddp.py`

#### 数学、性能模型与算法思路

$$
g=\frac{1}{W}\sum_{r=1}^{W}g_r,\qquad efficiency=\frac{T_1}{W\,T_W}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from common import SimpleNet, MyTrainDataset

import os
import torch.distributed as dist
import torch.multiprocessing as mp
from torch.nn.parallel import DistributedDataParallel as DDP


# (3) 初始化分布式通信组
def setup(rank, device_id, world_size, backend):
    os.environ["MASTER_ADDR"] = "127.0.0.1"
    # [变化示例] 目标切片 os.environ["MASTER_ADDR"]=旧值 -> "127.0.0.1"；base tensor 对应位置同步被写入。
    os.environ["MASTER_PORT"] = "29500"
    # [变化示例] 目标切片 os.environ["MASTER_PORT"]=旧值 -> "29500"；base tensor 对应位置同步被写入。
    dist.init_process_group(backend, rank=rank, world_size=world_size)
    # [变化示例] 执行状态：调用 dist.init_process_group(backend, rank=rank, world_size=worl... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    torch.cuda.set_device(device_id)
    # [变化示例] 执行状态：调用 torch.cuda.set_device(device_id) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


def train(model, optimizer, train_data, rank, device_id):
    for i, (src, target) in enumerate(train_data):
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        src = src.to(device_id)
        # [变化示例] src=未定义/旧值 -> src 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        target = target.to(device_id)
        # [变化示例] target=未定义/旧值 -> target 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        optimizer.zero_grad()
        # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
        output = model(src)
        # [变化示例] output=未定义/旧值 -> output 接收 model(src) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        loss = F.mse_loss(output, target)
        # [变化示例] loss=未定义/旧值 -> loss=均方误差；例如 prediction=[1,3]、target=[1,1] -> mean([0,4])=2。
        loss.backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
        optimizer.step()
        # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

        print(f"[GPU{rank}]: batch {i}/{len(train_data)}, loss: {loss}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。


def main(rank, world_size, backend):
    device_id = rank
    # [变化示例] device_id=未定义/旧值 -> device_id=rank；这是一次重新绑定/状态更新，右侧值决定新状态。
    setup(rank, device_id, world_size, backend)
    # [变化示例] 执行状态：调用 setup(rank, device_id, world_size, backend) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    model = SimpleNet().to(device_id)
    # [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

    # (4) 使用DDP封装模型，DDP会自动进行模型的初始化参数同步和批次训练结束后的梯度同步
    model = DDP(model, device_ids=[device_id])
    # [变化示例] model=未定义/旧值 -> model 接收 DDP(model, device_ids=[device_id]) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    optimizer = torch.optim.SGD(model.parameters(), lr=1e-2)
    # [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。

    batchsize_per_gpu = 32
    # [变化示例] batchsize_per_gpu=未定义/旧值 -> batchsize_per_gpu=32；这是一次重新绑定/状态更新，右侧值决定新状态。
    dataset = MyTrainDataset(num=2048, size=512)
    # [变化示例] dataset=未定义/旧值 -> dataset 接收 MyTrainDataset(num=2048, size=512) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # (1) 数据分割
    sampler = torch.utils.data.distributed.DistributedSampler(
        dataset, num_replicas=world_size, rank=rank
    )
    # [变化示例] sampler=未定义/旧值 -> sampler 接收 torch.utils.data.distributed.DistributedSampler( dataset, n... 的返回值；用 shape/dtype/device 与示例输入核对变化。
    train_data = DataLoader(dataset, batch_size=batchsize_per_gpu, sampler=sampler)
    # [变化示例] train_data=未定义/旧值 -> train_data=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。

    train(model, optimizer, train_data, rank, device_id)
    # [变化示例] 执行状态：调用 train(model, optimizer, train_data, rank, device_id) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。


if __name__ == "__main__":
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
    # (2) 多进程启动和管理
    world_size = 2
    # [变化示例] world_size=未定义/旧值 -> world_size=2；这是一次重新绑定/状态更新，右侧值决定新状态。
    mp.spawn(main, args=(world_size, "nccl"), nprocs=world_size, join=True)
    # [变化示例] 执行状态：调用 mp.spawn(main, args=(world_size, "nccl"), nprocs=world_size... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- 分布式 collective：所有 rank 必须以一致顺序参与；梯度求和后是否除 world_size 要与损失缩放约定一致。

#### 输入、输出与验证

- **验证方法。** 检查每个 rank 的参数初值、样本划分和 collective 顺序；一步更新后与单卡等效大 batch 结果做容差比较。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 197. AMP、torch.compile 与自定义算子 | 1_amp_perf_cont.py

**学习问题。** AMP 为什么能加速并节省显存？

**中文讲解。** autocast 为适合的算子选择低精度，Tensor Core 提升吞吐；GradScaler 主要防止 FP16 梯度下溢。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/1_amp_perf_cont.py`

#### 数学、性能模型与算法思路

$$
g=\operatorname{unscale}\!\left(\nabla_\theta(sL)\right),\qquad \theta\leftarrow\theta-\eta g
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
N, C, H, W = 32, 3, 256, 256  # Example dimensions
# [变化示例] N, C, H, W=未定义/旧值 -> N, C, H, W=tuple (32, 3, 256, 256)；多个值按位置传递/解包，元素本身不被复制。

data = torch.randn(10, N, C, H, W, device="cuda")
# [变化示例] data=未定义/旧值 -> data=按 10, N, C, H, W 创建的随机张量；shape 固定，具体值由 RNG 决定。
dataset = TensorDataset(data)
# [变化示例] dataset=未定义/旧值 -> dataset 接收 TensorDataset(data) 的返回值；用 shape/dtype/device 与示例输入核对变化。

model = SimpleCNN(C).to("cuda")
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

# warm up
train(dataset, model, use_amp=False)
# [变化示例] 执行状态：调用 train(dataset, model, use_amp=False) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
torch.cuda.synchronize()
# [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
# 测量未使用AMP时的时间和性能图谱
start_time = time.perf_counter()
# [变化示例] start_time=未定义/旧值 -> start_time=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    train(dataset, model, use_amp=False)
    # [变化示例] 执行状态：调用 train(dataset, model, use_amp=False) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
prof.export_chrome_trace("traces/PROF_wo_amp.json")
# [变化示例] 执行状态：调用 prof.export_chrome_trace("traces/PROF_wo_amp.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
end_time = time.perf_counter()
# [变化示例] end_time=未定义/旧值 -> end_time=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
elapsed = end_time - start_time
# [变化示例] elapsed=未定义/旧值 -> elapsed=end_time - start_time；数值示例：3 - 2 -> 1。
print(f"Float32 Time: {elapsed} seconds")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# warm up
train(dataset, model, use_amp=True)
# [变化示例] 执行状态：调用 train(dataset, model, use_amp=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
torch.cuda.synchronize()
# [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
# 测量使用AMP后的时间和性能图谱
start_time = time.perf_counter()
# [变化示例] start_time=未定义/旧值 -> start_time=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
    train(dataset, model, use_amp=True)
    # [变化示例] 执行状态：调用 train(dataset, model, use_amp=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
prof.export_chrome_trace("traces/PROF_amp.json")
# [变化示例] 执行状态：调用 prof.export_chrome_trace("traces/PROF_amp.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
end_time = time.perf_counter()
# [变化示例] end_time=未定义/旧值 -> end_time=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
elapsed = end_time - start_time
# [变化示例] elapsed=未定义/旧值 -> elapsed=end_time - start_time；数值示例：3 - 2 -> 1。
print(f"Float16 Time: {elapsed} seconds")
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 198. AMP、torch.compile 与自定义算子 | 1_amp_perf.py

**学习问题。** AMP 为什么能加速并节省显存？

**中文讲解。** autocast 为适合的算子选择低精度，Tensor Core 提升吞吐；GradScaler 主要防止 FP16 梯度下溢。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/1_amp_perf.py`

#### 数学、性能模型与算法思路

$$
g=\operatorname{unscale}\!\left(\nabla_\theta(sL)\right),\qquad \theta\leftarrow\theta-\eta g
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import time
import torch.nn as nn
from torch.profiler import profile, ProfilerActivity
from torch.optim import SGD
from torch.utils.data import TensorDataset


class SimpleCNN(nn.Module):
    def __init__(self, input_channels):
        super(SimpleCNN, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleCNN, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.conv1 = nn.Conv2d(
            input_channels, 64, kernel_size=3, stride=1, padding=1
        )
        # [变化示例] self.conv1=未定义/旧值 -> self.conv1 接收 nn.Conv2d( input_channels, 64, kernel_size=3, stride=1, pad... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.conv2 = nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1)
        # [变化示例] self.conv2=未定义/旧值 -> self.conv2 接收 nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.conv3 = nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=1)
        # [变化示例] self.conv3=未定义/旧值 -> self.conv3 接收 nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.conv4 = nn.Conv2d(256, 512, kernel_size=3, stride=1, padding=1)
        # [变化示例] self.conv4=未定义/旧值 -> self.conv4 接收 nn.Conv2d(256, 512, kernel_size=3, stride=1, padding=1) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.relu = nn.ReLU()
        # [变化示例] self.relu=未定义/旧值 -> self.relu=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。

    def forward(self, x):
        out = self.relu(self.conv1(x))
        # [变化示例] out=未定义/旧值 -> out=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        out = self.relu(self.conv2(out))
        # [变化示例] out=未定义/旧值 -> out=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        out = self.relu(self.conv3(out))
        # [变化示例] out=未定义/旧值 -> out=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        out = self.relu(self.conv4(out))
        # [变化示例] out=未定义/旧值 -> out=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        return out
        # [变化示例] 函数内部：out；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


def train(dataset, model, use_amp):
    optimizer = SGD(model.parameters(), lr=0.1, momentum=0.9)
    # [变化示例] optimizer=未定义/旧值 -> optimizer 接收 SGD(model.parameters(), lr=0.1, momentum=0.9) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    scaler = torch.cuda.amp.GradScaler(enabled=use_amp)
    # [变化示例] scaler=未定义/旧值 -> scaler 接收 torch.cuda.amp.GradScaler(enabled=use_amp) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    for batch_data in dataset:
        # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
        with torch.autocast(
            device_type="cuda", dtype=torch.float16, enabled=use_amp
        ):
            # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
            result = model(batch_data[0])
            # [变化示例] result=未定义/旧值 -> result 接收 model(batch_data[0]) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            loss = result.sum()
            # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。

        optimizer.zero_grad()
        # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
        scaler.scale(loss).backward()
        # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
        scaler.step(optimizer)
        # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。
        scaler.update()
        # [变化示例] 执行状态：调用 scaler.update() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。
- AMP：autocast 选择算子精度；FP16 常配 GradScaler，BF16 动态范围更大但硬件支持不同。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 199. AMP、torch.compile 与自定义算子 | 2_sigmod_cuda_kernel.cpp

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/2_sigmod_cuda_kernel.cpp`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```cpp
#include <cuda.h>
#include <cuda_runtime.h>
#include <torch/extension.h>

#include <iostream>
#include <vector>

template <typename scalar_t>
__global__ void sigmoid_kernel(const scalar_t *__restrict__ input_tensor_data,
                               scalar_t *__restrict__ output_tensor_data,
                               size_t total_num_elements) {
    // 计算要处理的元素位置
    const int element_index = blockIdx.x * blockDim.x + threadIdx.x;
    // [变化示例] 线程坐标 -> 一维元素索引；例如 blockIdx=2、blockDim=512、threadIdx=3 -> index=1027。

    if (element_index < total_num_elements) {
        // 在单个元素上进行sigmoid计算
        scalar_t x = input_tensor_data[element_index];
        // [变化示例] 输入数组与 element_index -> 读取单个 x；例如 index=2 -> input[2]。
        scalar_t y = 1.0 / (1.0 + exp(-x));
        // [变化示例] 输入标量 x -> Sigmoid y；例如 x=0 -> y=0.5。

        // 将计算结果写回显存
        output_tensor_data[element_index] = y;
        // [变化示例] 输出位置原值 -> 写入 y；例如 y=0.5 时 output[index] -> 0.5。
    }
}
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 200. AMP、torch.compile 与自定义算子 | 3_sigmoid_cuda_op.cpp

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/3_sigmoid_cuda_op.cpp`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```cpp
torch::Tensor custom_sigmoid_cuda_forward(torch::Tensor input) {
    size_t total_num_elements = input.numel();
    // [变化示例] 多维输入 shape -> 元素总数；例如 (2,3) -> 6。

    auto output = torch::zeros_like(input);
    // [变化示例] 输入 tensor -> 同 shape/dtype/device 的全 0 输出 tensor。

    const int threads = 512;
    // [变化示例] 线程块大小=未设置 -> 512 threads/block。
    const int blocks = (total_num_elements + threads - 1) / threads;
    // [变化示例] 元素数 -> 向上取整的 block 数；例如 N=1000、threads=512 -> blocks=2。

    // 将实现好的CUDA kernel注册为前向算子的CUDA后端实现
    AT_DISPATCH_FLOATING_TYPES(
        input.type(), "sigmoid_kernel", ([&] {
            sigmoid_kernel<scalar_t><<<blocks, threads>>>(
                input.data<scalar_t>(), output.data<scalar_t>(),
                total_num_elements);
        }));
        // [变化示例] 执行前状态 -> 完成 AT_DISPATCH_FLOATING_TYPES( input.type(), "sigmoid_kernel", ([&] { sigmoid_kernel<sca...；检查返回码、输出 tensor 或注册表确认变化。

    return output;
    // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return output;。
}
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 201. AMP、torch.compile 与自定义算子 | 4_sigmoid_bwd.cpp

**学习问题。** Sigmoid backward 需要保存什么？

**中文讲解。** 若已保存输出 y，导数可写成 y(1-y)，通常无需再次保存输入并重算 sigmoid。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/4_sigmoid_bwd.cpp`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```cpp
template <typename scalar_t>
__global__ void sigmoid_grad_kernel(
    const scalar_t *__restrict__ output_tensor,
    const scalar_t *__restrict__ output_grad_tensor,
    scalar_t *__restrict__ input_grad_tensor, size_t total_num_elements) {
    // 计算要处理的元素位置
    const int element_index = blockIdx.x * blockDim.x + threadIdx.x;
    // [变化示例] 线程坐标 -> 一维元素索引；例如 blockIdx=2、blockDim=512、threadIdx=3 -> index=1027。
    if (element_index < total_num_elements) {
        // 在单个元素上进行sigmoid的梯度计算
        scalar_t output_grad = output_grad_tensor[element_index];
        // [变化示例] 左侧=旧值/未定义 -> 按 scalar_t output_grad = output_grad_tensor[element_index]; 计算并更新；shape 与 dtype 由右侧表达式决定。
        scalar_t output = output_tensor[element_index];
        // [变化示例] 左侧=旧值/未定义 -> 按 scalar_t output = output_tensor[element_index]; 计算并更新；shape 与 dtype 由右侧表达式决定。
        scalar_t input_grad = (1.0 - output) * output * output_grad;
        // [变化示例] 左侧=旧值/未定义 -> 按 scalar_t input_grad = (1.0 - output) * output * output_grad; 计算并更新；shape 与 dtype 由右侧表达式决定。
        // 将计算结果写回显存
        input_grad_tensor[element_index] = input_grad;
        // [变化示例] 左侧=旧值/未定义 -> 按 input_grad_tensor[element_index] = input_grad; 计算并更新；shape 与 dtype 由右侧表达式决定。
    }
}

torch::Tensor custom_sigmoid_cuda_backward(torch::Tensor output,
                                           torch::Tensor output_grad) {
    size_t total_num_elements = output_grad.numel();
    // [变化示例] 多维输入 shape -> 元素总数；例如 (2,3) -> 6。
    auto input_grad = torch::zeros_like(output_grad);
    // [变化示例] 输入 tensor -> 同 shape/dtype/device 的全 0 输出 tensor。
    const int threads = 512;
    // [变化示例] 线程块大小=未设置 -> 512 threads/block。
    const int blocks = (total_num_elements + threads - 1) / threads;
    // [变化示例] 元素数 -> 向上取整的 block 数；例如 N=1000、threads=512 -> blocks=2。

    // 将实现好的CUDA kernel注册为反向算子的CUDA后端实现
    AT_DISPATCH_FLOATING_TYPES(
        output_grad.type(), "sigmoid_grad_kernel", ([&] {
            sigmoid_grad_kernel<scalar_t><<<blocks, threads>>>(
                output.data<scalar_t>(), output_grad.data<scalar_t>(),
                input_grad.data<scalar_t>(), total_num_elements);
        }));
        // [变化示例] 执行前状态 -> 完成 AT_DISPATCH_FLOATING_TYPES( output_grad.type(), "sigmoid_grad_kernel", ([&] { sigmoid...；检查返回码、输出 tensor 或注册表确认变化。

    return input_grad;
    // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return input_grad;。
}
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 202. AMP、torch.compile 与自定义算子 | 5_register_cpp.cpp

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/5_register_cpp.cpp`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```cpp
#include <torch/extension.h>

#include <iostream>
#include <vector>

// forward declarations or include the header
torch::Tensor custom_sigmoid_cuda_forward(torch::Tensor input);
// [变化示例] 执行前状态 -> 完成 torch::Tensor custom_sigmoid_cuda_forward(torch::Tensor input);；检查返回码、输出 tensor 或注册表确认变化。

torch::Tensor custom_sigmoid_cuda_backward(torch::Tensor output,
                                           torch::Tensor output_grad);
                                           // [变化示例] 执行前状态 -> 完成 torch::Tensor custom_sigmoid_cuda_backward(torch::Tensor output, torch::Tensor output...；检查返回码、输出 tensor 或注册表确认变化。

// 简易的sigmoid前向算子的CPU后端实现
torch::Tensor custom_sigmoid_cpu_forward(torch::Tensor input) {
    return 1.0 / (1 + torch::exp(-input));
    // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return 1.0 / (1 + torch::exp(-input));。
}

// 简易的sigmoid反向算子的CPU后端实现
torch::Tensor custom_sigmoid_cpu_backward(torch::Tensor output,
                                          torch::Tensor output_grad) {
    return (1 - output) * output * output_grad;
    // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return (1 - output) * output * output_grad;。
}

// 进行前向算子的后端实现分发
torch::Tensor custom_sigmoid_forward(torch::Tensor input) {
    TORCH_CHECK(input.is_contiguous(), "input must be contiguous")

    if (input.device().is_cuda()) {
        return custom_sigmoid_cuda_forward(input);
        // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
    } else {
        return custom_sigmoid_cpu_forward(input);
        // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
    }
}

// 进行反向算子的后端实现分发
torch::Tensor custom_sigmoid_backward(torch::Tensor output,
                                      torch::Tensor grad_output) {
    TORCH_CHECK(grad_output.is_contiguous(), "input must be contiguous")

    if (output.device().is_cuda()) {
        return custom_sigmoid_cuda_backward(output, grad_output);
        // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
    } else {
        return custom_sigmoid_cpu_backward(output, grad_output);
        // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
    }
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    // 注册算子以便在Python中调用
    m.def("sigmoid_fwd", &custom_sigmoid_forward, "Custom sigmoid forward");
    // [变化示例] 执行前状态 -> 完成 m.def("sigmoid_fwd", &custom_sigmoid_forward, "Custom sigmoid forward");；检查返回码、输出 tensor 或注册表确认变化。
    m.def("sigmoid_bwd", &custom_sigmoid_backward, "Custom sigmoid backward");
    // [变化示例] 执行前状态 -> 完成 m.def("sigmoid_bwd", &custom_sigmoid_backward, "Custom sigmoid backward");；检查返回码、输出 tensor 或注册表确认变化。
}
```

#### 代码/API 逐项解释

- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 203. AMP、torch.compile 与自定义算子 | 6_setup.py

**学习问题。** PyTorch C++/CUDA Extension 如何构建？

**中文讲解。** setup.py 描述源文件、编译参数和扩展名；构建需要可用编译器、CUDA toolkit 与匹配的 PyTorch ABI。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/6_setup.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
from setuptools import setup
from torch.utils.cpp_extension import BuildExtension, CppExtension


setup(
    name="custom_ops",
    ext_modules=[
        CppExtension(
            "custom_ops",
            [
                "custom_sigmoid.cpp",
                "custom_sigmoid_cuda.cu",
            ],
            extra_compile_args={"cxx": ["-g"], "nvcc": ["-O2"]},
        )
    ],
    cmdclass={"build_ext": BuildExtension},
)
# [变化示例] 执行状态：调用 setup( name="custom_ops", ext_modules=[ CppExtension( "cust... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 扩展注册：schema 与 CPU/CUDA dispatch 实现必须一致，并为 autograd/compile 提供必要元信息。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 204. AMP、torch.compile 与自定义算子 | 7_install_cmd.sh

**学习问题。** 如何安装本地自定义算子？

**中文讲解。** 通常使用 pip install -v . 或 develop/editable 模式触发编译；应保留完整编译日志排查架构和 ABI 问题。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/7_install_cmd.sh`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
python setup.py install
# [变化示例] 源码与构建配置 -> 已编译/安装的 Python 扩展（失败时保持未安装）。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 205. AMP、torch.compile 与自定义算子 | 8_register_pytorch.py

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/8_register_pytorch.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
from torch.autograd import Function

# custom_ops 便是我们自定义的Python扩展模块，包含了C++中编写的自定义sigmoid算子
import custom_ops


class CustomSigmoidFunction(Function):
    @staticmethod
    def forward(ctx, input):
        # 调用自定义算子的前向操作
        output = custom_ops.sigmoid_fwd(input)
        # [变化示例] output=未定义/旧值 -> output 接收 custom_ops.sigmoid_fwd(input) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        ctx.save_for_backward(output)
        # [变化示例] 执行状态：调用 ctx.save_for_backward(output) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        return output
        # [变化示例] 函数内部：output；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    @staticmethod
    def backward(ctx, grad_output):
        (output,) = ctx.saved_tensors
        # [变化示例] (output,)=未定义/旧值 -> (output,)=ctx.saved_tensors；这是一次重新绑定/状态更新，右侧值决定新状态。
        # 调用自定义算子的反向操作
        grad_input = custom_ops.sigmoid_bwd(output, grad_output.contiguous())
        # [变化示例] grad_input=未定义/旧值 -> grad_input 接收 custom_ops.sigmoid_bwd(output, grad_output.contiguous()) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return grad_input
        # [变化示例] 函数内部：grad_input；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


class CustomSigmoid(torch.nn.Module):
    def forward(self, input):
        return CustomSigmoidFunction.apply(input)
        # [变化示例] 函数内部：执行 CustomSigmoidFunction.apply(input) 得到结果 -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 206. AMP、torch.compile 与自定义算子 | 9_custom_op_main.py

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/9_custom_op_main.py`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn.functional as F
import numpy as np
from custom_sigmoid_op import CustomSigmoid


def run(np_input, sigmoid_op, device="cuda"):
    x = torch.tensor(np_input, dtype=torch.double, device=device, requires_grad=True)
    # [变化示例] x=未定义/旧值 -> x=由给定数据构造的 tensor，并采用显式/推断的 dtype 与 device。
    output = sigmoid_op(x)
    # [变化示例] output=未定义/旧值 -> output 接收 sigmoid_op(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    loss = torch.sum(output)
    # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。
    loss.backward()
    # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

    return output.clone(), x.grad.clone()
    # [变化示例] 函数内部：独立副本；数值相同，但后续原地修改不再共享同一 storage -> 调用方收到该输出。


custom_sigmoid = CustomSigmoid()
# [变化示例] custom_sigmoid=未定义/旧值 -> custom_sigmoid=CustomSigmoid()；这是一次重新绑定/状态更新，右侧值决定新状态。

device = "cuda"
# [变化示例] device=未定义/旧值 -> device="cuda"；这是一次重新绑定/状态更新，右侧值决定新状态。

np_input = np.random.randn(10, 20)
# [变化示例] np_input=未定义/旧值 -> np_input 接收 np.random.randn(10, 20) 的返回值；用 shape/dtype/device 与示例输入核对变化。

# 确保自定义算子各个后端的计算结果与PyTorch原生sigmoid算子的结果是一致的
for device in ["cpu", "cuda"]:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    sigmoid_out_torch, sigmoid_grad_torch = run(np_input, torch.sigmoid, device)
    # [变化示例] sigmoid_out_torch, sigmoid_grad_torch=未定义/旧值 -> sigmoid_out_torch, sigmoid_grad_torch 接收 run(np_input, torch.sigmoid, device) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    sigmoid_out_custom, sigmoid_grad_custom = run(np_input, custom_sigmoid, device)
    # [变化示例] sigmoid_out_custom, sigmoid_grad_custom=未定义/旧值 -> sigmoid_out_custom, sigmoid_grad_custom 接收 run(np_input, custom_sigmoid, device) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # Compare results
    if torch.allclose(sigmoid_out_torch, sigmoid_out_custom) and torch.allclose(
        sigmoid_grad_torch, sigmoid_grad_custom
    ):
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        print(f"Pass on {device}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
    else:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        print(f"Error: results mismatch on {device}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 207. AMP、torch.compile 与自定义算子 | 10_compile.py

**学习问题。** torch.compile 的基本性能模型是什么？

**中文讲解。** 编译器捕获 Python/tensor 图并做融合与代码生成；首次编译有成本，收益取决于图稳定性和重复次数。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/10_compile.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn as nn


class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        # [变化示例] 执行状态：调用 super(SimpleNet, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.fc1 = nn.Linear(1000, 20000)
        # [变化示例] self.fc1=未定义/旧值 -> self.fc1=线性映射模块；输入最后一维 1000 -> 输出最后一维 20000。

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        # [变化示例] x=未定义/旧值 -> x=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        y = x
        # [变化示例] y=未定义/旧值 -> y=x；这是一次重新绑定/状态更新，右侧值决定新状态。
        for _ in range(50):
            # [变化示例] 循环示例：range(50) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            y = y * x
            # [变化示例] y=未定义/旧值 -> y=y * x；数值示例：2 * 3 -> 6。
        return y
        # [变化示例] 函数内部：y；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


# 未经优化的模型
model = SimpleNet().cuda()
# [变化示例] model=未定义/旧值 -> model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。

# 打开torch.compile追踪模型的执行过程并自动优化
compiled_model = torch.compile(model)
# [变化示例] compiled_model=未定义/旧值 -> compiled_model 接收 torch.compile(model) 的返回值；用 shape/dtype/device 与示例输入核对变化。


def timed(fn):
    start = torch.cuda.Event(enable_timing=True)
    # [变化示例] start=未定义/旧值 -> start 接收 torch.cuda.Event(enable_timing=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    end = torch.cuda.Event(enable_timing=True)
    # [变化示例] end=未定义/旧值 -> end 接收 torch.cuda.Event(enable_timing=True) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    start.record()
    # [变化示例] 执行状态：调用 start.record() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    result = fn()
    # [变化示例] result=未定义/旧值 -> result=fn()；这是一次重新绑定/状态更新，右侧值决定新状态。
    end.record()
    # [变化示例] 执行状态：调用 end.record() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
    return result, start.elapsed_time(end) / 1000
    # [变化示例] 函数内部：tuple (result, start.elapsed_time(end) / 1000)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。


N_ITERS = 5
# [变化示例] N_ITERS=未定义/旧值 -> N_ITERS=5；这是一次重新绑定/状态更新，右侧值决定新状态。


def benchmark(model):
    times = []
    # [变化示例] times=未定义/旧值 -> times=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
    for i in range(N_ITERS):
        # [变化示例] 循环示例：range(N_ITERS) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
        input_data = torch.randn(1000, 1000, device="cuda")
        # [变化示例] input_data=未定义/旧值 -> input_data=按 1000, 1000 创建的随机张量；shape 固定，具体值由 RNG 决定。
        _, time = timed(lambda: model(input_data))
        # [变化示例] _, time=未定义/旧值 -> _, time 接收 timed(lambda: model(input_data)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        times.append(time)
        # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
    return times
    # [变化示例] 函数内部：times；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


print("eager模式", benchmark(model))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
print("打开torch.compile后", benchmark(compiled_model))
# [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

# 输出
# eager模式 [1.1121439208984376, 0.01659187126159668, 0.01635430335998535, 0.016350208282470705, 0.016306175231933593]
# 打开torch.compile后 [1.79336083984375, 0.002367487907409668, 0.0022937600612640383, 0.002292736053466797, 0.002288640022277832]
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- 编译 API：graph break、动态 shape 和首次编译成本决定收益；要比较稳态而不是首轮。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 208. AMP、torch.compile 与自定义算子 | 11_fullgraph.py

**学习问题。** fullgraph=True 为什么更严格？

**中文讲解。** 它要求整个函数形成单一可捕获图；任何 graph break 都报错，适合定位不被编译器支持的路径。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/11_fullgraph.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
torch.compile(..., fullgraph=True)
# [变化示例] 执行状态：调用 torch.compile(..., fullgraph=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 编译 API：graph break、动态 shape 和首次编译成本决定收益；要比较稳态而不是首轮。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 209. AMP、torch.compile 与自定义算子 | 12_dynamic.py

**学习问题。** dynamic shape 编译解决什么问题？

**中文讲解。** 符号 shape 可让一个编译图覆盖多个输入尺寸，但约束推理更复杂，优化空间可能小于静态 shape。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/12_dynamic.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
torch.compile(..., dynamic=True)
# [变化示例] 执行状态：调用 torch.compile(..., dynamic=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 编译 API：graph break、动态 shape 和首次编译成本决定收益；要比较稳态而不是首轮。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 210. AMP、torch.compile 与自定义算子 | 13_mode.py

**学习问题。** torch.compile mode 如何取舍编译时间与运行速度？

**中文讲解。** default、reduce-overhead、max-autotune 对 CUDA Graph、搜索和编译时间采用不同策略，应按 workload 生命周期选择。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/13_mode.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
torch.compile(..., mode="reduce-overhead")
# [变化示例] 执行状态：调用 torch.compile(..., mode="reduce-overhead") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 编译 API：graph break、动态 shape 和首次编译成本决定收益；要比较稳态而不是首轮。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 211. AMP、torch.compile 与自定义算子 | 14_data_dependent.py

**学习问题。** 数据依赖控制流为何容易 graph break？

**中文讲解。** 从 tensor 取 Python 标量或按数据决定分支会把设备值带回 host；可用 tensor 化控制流或显式图边界处理。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/14_data_dependent.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
class DataDependentNet(nn.Module):
    def __init__(self):
        super(DataDependentNet, self).__init__()
        # [变化示例] 执行状态：调用 super(DataDependentNet, self).__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.linear1 = nn.Linear(10, 5)
        # [变化示例] self.linear1=未定义/旧值 -> self.linear1=线性映射模块；输入最后一维 10 -> 输出最后一维 5。
        self.linear2 = nn.Linear(5, 2)
        # [变化示例] self.linear2=未定义/旧值 -> self.linear2=线性映射模块；输入最后一维 5 -> 输出最后一维 2。
        self.linear3 = nn.Linear(5, 3)
        # [变化示例] self.linear3=未定义/旧值 -> self.linear3=线性映射模块；输入最后一维 5 -> 输出最后一维 3。

    def forward(self, x):
        tmp = F.relu(self.linear1(x))
        # [变化示例] tmp=未定义/旧值 -> tmp=逐元素 ReLU；例如 [-2,0,3] -> [0,0,3]。
        # 有数据依赖的控制流：如果x的第一个元素大于0.5，使用linear2，否则使用linear3
        if tmp[0, 0] > 0.5:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            return self.linear2(tmp)
            # [变化示例] 函数内部：执行 self.linear2(tmp) 得到结果 -> 调用方收到该输出。
        else:
            # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
            return self.linear3(tmp)
            # [变化示例] 函数内部：执行 self.linear3(tmp) 得到结果 -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- nn.Module 参数注册：在 __init__ 中创建子模块，才能被 state_dict、device 迁移和优化器发现。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 212. AMP、torch.compile 与自定义算子 | 15_fused_triton.py

**学习问题。** Triton 融合 kernel 的价值是什么？

**中文讲解。** 把多次逐元素读写合并为一次设备程序，减少 HBM 流量和 launch；必须处理 mask、布局和数值精度。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/15_fused_triton.py`

#### 数学、性能模型与算法思路

$$
speedup=\frac{T_{eager}}{T_{optimized}},\qquad T_{total}=T_{compile}+N\,T_{run}
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
@pointwise(
    size_hints=[33554432],
    filename=__file__,
    triton_meta={
        "signature": {0: "*fp32", 1: "*fp32", 2: "i32"},
        "device": 0,
        "device_type": "cuda",
        "constants": {},
        "configs": [
            instance_descriptor(
                divisible_by_16=(0, 1, 2),
                equal_to_1=(),
                ids_of_folded_args=(),
                divisible_by_8=(2,),
            )
        ],
    },
    inductor_meta={
        "autotune_hints": set(),
        "kernel_name": "triton_poi_fused_mul_relu_0",
        "mutated_arg_names": ["in_out_ptr0"],
    },
    min_elem_per_thread=0,
)
@triton.jit
def triton_(in_out_ptr0, in_ptr0, xnumel, XBLOCK: tl.constexpr):
    xnumel = 20000000
    # [变化示例] xnumel=未定义/旧值 -> xnumel=20000000；这是一次重新绑定/状态更新，右侧值决定新状态。
    xoffset = tl.program_id(0) * XBLOCK
    # [变化示例] xoffset=未定义/旧值 -> xoffset=tl.program_id(0) * XBLOCK；数值示例：2 * 3 -> 6。
    xindex = xoffset + tl.arange(0, XBLOCK)[:]
    # [变化示例] xindex=未定义/旧值 -> xindex=xoffset + tl.arange(0, XBLOCK)[:]；数值示例：2 + 3 -> 5。
    xmask = xindex < xnumel
    # [变化示例] xmask=未定义/旧值 -> xmask=xindex < xnumel；这是一次重新绑定/状态更新，右侧值决定新状态。
    x0 = xindex
    # [变化示例] x0=未定义/旧值 -> x0=xindex；这是一次重新绑定/状态更新，右侧值决定新状态。
    tmp0 = tl.load(in_ptr0 + (x0), xmask)
    # [变化示例] tmp0=未定义/旧值 -> tmp0 接收 tl.load(in_ptr0 + (x0), xmask) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    tmp1 = triton_helpers.maximum(0, tmp0)
    # [变化示例] tmp1=未定义/旧值 -> tmp1 接收 triton_helpers.maximum(0, tmp0) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    tmp2 = tmp1 * tmp1
    # [变化示例] tmp2=未定义/旧值 -> tmp2=tmp1 * tmp1；数值示例：2 * 3 -> 6。
    tmp3 = tmp2 * tmp1
    # [变化示例] tmp3=未定义/旧值 -> tmp3=tmp2 * tmp1；数值示例：2 * 3 -> 6。
    ...  # 篇幅原因省略中间的行
    tmp49 = tmp48 * tmp1
    # [变化示例] tmp49=未定义/旧值 -> tmp49=tmp48 * tmp1；数值示例：2 * 3 -> 6。
    tmp50 = tmp49 * tmp1
    # [变化示例] tmp50=未定义/旧值 -> tmp50=tmp49 * tmp1；数值示例：2 * 3 -> 6。
    tmp51 = tmp50 * tmp1
    # [变化示例] tmp51=未定义/旧值 -> tmp51=tmp50 * tmp1；数值示例：2 * 3 -> 6。
    tl.store(in_out_ptr0 + (x0), tmp51, xmask)
    # [变化示例] 执行状态：调用 tl.store(in_out_ptr0 + (x0), tmp51, xmask) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。
- Triton：program_id 划分程序实例，mask 保护尾块，load/store 布局决定访存合并。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 213. AMP、torch.compile 与自定义算子 | custom_sigmoid_cuda.cu

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/custom_op_src/custom_sigmoid_cuda.cu`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```cpp
#include <torch/extension.h>

#include <cuda.h>
#include <cuda_runtime.h>

#include <vector>
#include <iostream>

template <typename scalar_t>
__global__ void sigmoid_kernel(const scalar_t* __restrict__ input_tensor_data,
                               scalar_t* __restrict__ output_tensor_data,
                               size_t total_num_elements) {
  // Fetch thread id
  const int element_index = blockIdx.x * blockDim.x + threadIdx.x;
  // [变化示例] 线程坐标 -> 一维元素索引；例如 blockIdx=2、blockDim=512、threadIdx=3 -> index=1027。

  if (element_index < total_num_elements) {
    // Sigmoid Function
    scalar_t x = input_tensor_data[element_index];
    // [变化示例] 输入数组与 element_index -> 读取单个 x；例如 index=2 -> input[2]。
    scalar_t y = 1.0 / (1.0 + exp(-x));
    // [变化示例] 输入标量 x -> Sigmoid y；例如 x=0 -> y=0.5。

    // Write to output
    output_tensor_data[element_index] = y;
    // [变化示例] 输出位置原值 -> 写入 y；例如 y=0.5 时 output[index] -> 0.5。
  }
}

torch::Tensor custom_sigmoid_cuda_forward(
    torch::Tensor input) {

  size_t total_num_elements = input.numel();
  // [变化示例] 多维输入 shape -> 元素总数；例如 (2,3) -> 6。

  auto output = torch::zeros_like(input);
  // [变化示例] 输入 tensor -> 同 shape/dtype/device 的全 0 输出 tensor。

  const int threads = 512;
  // [变化示例] 线程块大小=未设置 -> 512 threads/block。
  const int blocks = (total_num_elements + threads - 1) / threads;
  // [变化示例] 元素数 -> 向上取整的 block 数；例如 N=1000、threads=512 -> blocks=2。

  AT_DISPATCH_FLOATING_TYPES(input.type(), "sigmoid_kernel", ([&] {
    sigmoid_kernel<scalar_t><<<blocks, threads>>>(
        input.data<scalar_t>(),
        output.data<scalar_t>(),
        total_num_elements);
  }));
  // [变化示例] 执行前状态 -> 完成 AT_DISPATCH_FLOATING_TYPES(input.type(), "sigmoid_kernel", ([&] { sigmoid_kernel<scal...；检查返回码、输出 tensor 或注册表确认变化。

  return output;
  // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return output;。
}

template <typename scalar_t>
__global__ void sigmoid_grad_kernel(const scalar_t* __restrict__ output_tensor,
                                    const scalar_t* __restrict__ output_grad_tensor,
                                    scalar_t* __restrict__ input_grad_tensor,
                                    size_t total_num_elements) {
  // Fetch thread id
  const int element_index = blockIdx.x * blockDim.x + threadIdx.x;
  // [变化示例] 线程坐标 -> 一维元素索引；例如 blockIdx=2、blockDim=512、threadIdx=3 -> index=1027。

  if (element_index < total_num_elements) {
    // Sigmoid Grad Function
    scalar_t output_grad = output_grad_tensor[element_index];
    // [变化示例] 左侧=旧值/未定义 -> 按 scalar_t output_grad = output_grad_tensor[element_index]; 计算并更新；shape 与 dtype 由右侧表达式决定。
    scalar_t output = output_tensor[element_index];
    // [变化示例] 左侧=旧值/未定义 -> 按 scalar_t output = output_tensor[element_index]; 计算并更新；shape 与 dtype 由右侧表达式决定。

    scalar_t input_grad = (1.0 - output) * output * output_grad;
    // [变化示例] 左侧=旧值/未定义 -> 按 scalar_t input_grad = (1.0 - output) * output * output_grad; 计算并更新；shape 与 dtype 由右侧表达式决定。

    // Write to output
    input_grad_tensor[element_index] = input_grad;
    // [变化示例] 左侧=旧值/未定义 -> 按 input_grad_tensor[element_index] = input_grad; 计算并更新；shape 与 dtype 由右侧表达式决定。
  }
}

torch::Tensor custom_sigmoid_cuda_backward(
    torch::Tensor output,
    torch::Tensor output_grad) {

  size_t total_num_elements = output_grad.numel();
  // [变化示例] 多维输入 shape -> 元素总数；例如 (2,3) -> 6。

  auto input_grad = torch::zeros_like(output_grad);
  // [变化示例] 输入 tensor -> 同 shape/dtype/device 的全 0 输出 tensor。

  const int threads = 512;
  // [变化示例] 线程块大小=未设置 -> 512 threads/block。
  const int blocks = (total_num_elements + threads - 1) / threads;
  // [变化示例] 元素数 -> 向上取整的 block 数；例如 N=1000、threads=512 -> blocks=2。

  AT_DISPATCH_FLOATING_TYPES(output_grad.type(), "sigmoid_grad_kernel", ([&] {
    sigmoid_grad_kernel<scalar_t><<<blocks, threads>>>(
        output.data<scalar_t>(),
        output_grad.data<scalar_t>(),
        input_grad.data<scalar_t>(),
        total_num_elements);
  }));
  // [变化示例] 执行前状态 -> 完成 AT_DISPATCH_FLOATING_TYPES(output_grad.type(), "sigmoid_grad_kernel", ([&] { sigmoid_...；检查返回码、输出 tensor 或注册表确认变化。

  return input_grad;
  // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return input_grad;。
}
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 214. AMP、torch.compile 与自定义算子 | custom_sigmoid_op.py

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/custom_op_src/custom_sigmoid_op.py`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
from torch.autograd import Function
import custom_ops


class CustomSigmoidFunction(Function):
    @staticmethod
    def forward(ctx, input):
        output = custom_ops.sigmoid_fwd(input)
        # [变化示例] output=未定义/旧值 -> output 接收 custom_ops.sigmoid_fwd(input) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        ctx.save_for_backward(output)
        # [变化示例] 执行状态：调用 ctx.save_for_backward(output) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        return output
        # [变化示例] 函数内部：output；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    @staticmethod
    def backward(ctx, grad_output):
        (output,) = ctx.saved_tensors
        # [变化示例] (output,)=未定义/旧值 -> (output,)=ctx.saved_tensors；这是一次重新绑定/状态更新，右侧值决定新状态。
        grad_input = custom_ops.sigmoid_bwd(output, grad_output.contiguous())
        # [变化示例] grad_input=未定义/旧值 -> grad_input 接收 custom_ops.sigmoid_bwd(output, grad_output.contiguous()) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return grad_input
        # [变化示例] 函数内部：grad_input；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。


class CustomSigmoid(torch.nn.Module):
    def forward(self, input):
        return CustomSigmoidFunction.apply(input)
        # [变化示例] 函数内部：执行 CustomSigmoidFunction.apply(input) 得到结果 -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 215. AMP、torch.compile 与自定义算子 | custom_sigmoid.cpp

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/custom_op_src/custom_sigmoid.cpp`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```cpp
#include <torch/extension.h>

#include <vector>
#include <iostream>

// forward declarations or include the header
torch::Tensor custom_sigmoid_cuda_forward(
    torch::Tensor input);
    // [变化示例] 执行前状态 -> 完成 torch::Tensor custom_sigmoid_cuda_forward( torch::Tensor input);；检查返回码、输出 tensor 或注册表确认变化。

torch::Tensor custom_sigmoid_cuda_backward(
    torch::Tensor output,
    torch::Tensor output_grad);
    // [变化示例] 执行前状态 -> 完成 torch::Tensor custom_sigmoid_cuda_backward( torch::Tensor output, torch::Tensor outpu...；检查返回码、输出 tensor 或注册表确认变化。

torch::Tensor custom_sigmoid_cpu_forward(
    torch::Tensor input) {
      return 1.0 / (1 + torch::exp(-input));
      // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return 1.0 / (1 + torch::exp(-input));。
    }

torch::Tensor custom_sigmoid_cpu_backward(
    torch::Tensor output,
    torch::Tensor output_grad) {
      return (1 - output) * output * output_grad;
      // [变化示例] 函数内部结果 -> 返回给调用方；对应语句为 return (1 - output) * output * output_grad;。
    }

// Cpp wrapper function
torch::Tensor custom_sigmoid_forward(
    torch::Tensor input) {
  TORCH_CHECK(input.is_contiguous(), "input must be contiguous")

  if (input.device().is_cuda()) {
    return custom_sigmoid_cuda_forward(input);
    // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
  } else {
    return custom_sigmoid_cpu_forward(input);
    // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
  }
 }

torch::Tensor custom_sigmoid_backward(
    torch::Tensor output,
    torch::Tensor grad_output) {
  TORCH_CHECK(grad_output.is_contiguous(), "input must be contiguous")

  if (output.device().is_cuda()) {
    return custom_sigmoid_cuda_backward(output, grad_output);
    // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
  } else {
    return custom_sigmoid_cpu_backward(output, grad_output);
    // [变化示例] 输入 x=[-1,0,1] -> Sigmoid 输出约 [0.269,0.5,0.731]。
  }

}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
  m.def("sigmoid_fwd", &custom_sigmoid_forward, "Custom sigmoid forward");
  // [变化示例] 执行前状态 -> 完成 m.def("sigmoid_fwd", &custom_sigmoid_forward, "Custom sigmoid forward");；检查返回码、输出 tensor 或注册表确认变化。
  m.def("sigmoid_bwd", &custom_sigmoid_backward, "Custom sigmoid backward");
  // [变化示例] 执行前状态 -> 完成 m.def("sigmoid_bwd", &custom_sigmoid_backward, "Custom sigmoid backward");；检查返回码、输出 tensor 或注册表确认变化。
}
```

#### 代码/API 逐项解释

- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 216. AMP、torch.compile 与自定义算子 | main.py

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/custom_op_src/main.py`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
import torch.nn.functional as F
import numpy as np
from custom_sigmoid_op import CustomSigmoid


def run(np_input, sigmoid_op, device="cuda"):
    x = torch.tensor(np_input, dtype=torch.double, device=device, requires_grad=True)
    # [变化示例] x=未定义/旧值 -> x=由给定数据构造的 tensor，并采用显式/推断的 dtype 与 device。
    output = sigmoid_op(x)
    # [变化示例] output=未定义/旧值 -> output 接收 sigmoid_op(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    loss = torch.sum(output)
    # [变化示例] loss=未定义/旧值 -> loss=沿指定维求和；例如 [1,2,3] -> 6，keepdim 决定归约轴是否保留。
    loss.backward()
    # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。

    return output.clone(), x.grad.clone()
    # [变化示例] 函数内部：独立副本；数值相同，但后续原地修改不再共享同一 storage -> 调用方收到该输出。


custom_sigmoid = CustomSigmoid()
# [变化示例] custom_sigmoid=未定义/旧值 -> custom_sigmoid=CustomSigmoid()；这是一次重新绑定/状态更新，右侧值决定新状态。

device = "cuda"
# [变化示例] device=未定义/旧值 -> device="cuda"；这是一次重新绑定/状态更新，右侧值决定新状态。

# Prepare a random input tensor
np_input = np.random.randn(10, 20)
# [变化示例] np_input=未定义/旧值 -> np_input 接收 np.random.randn(10, 20) 的返回值；用 shape/dtype/device 与示例输入核对变化。

for device in ["cpu", "cuda"]:
    # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
    sigmoid_out_torch, sigmoid_grad_torch = run(np_input, torch.sigmoid, device)
    # [变化示例] sigmoid_out_torch, sigmoid_grad_torch=未定义/旧值 -> sigmoid_out_torch, sigmoid_grad_torch 接收 run(np_input, torch.sigmoid, device) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    sigmoid_out_custom, sigmoid_grad_custom = run(np_input, custom_sigmoid, device)
    # [变化示例] sigmoid_out_custom, sigmoid_grad_custom=未定义/旧值 -> sigmoid_out_custom, sigmoid_grad_custom 接收 run(np_input, custom_sigmoid, device) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # Compare results
    if torch.allclose(sigmoid_out_torch, sigmoid_out_custom) and torch.allclose(
        sigmoid_grad_torch, sigmoid_grad_custom
    ):
        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
        print(f"Pass on {device}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
    else:
        # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
        print(f"Error: results mismatch on {device}")
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 217. AMP、torch.compile 与自定义算子 | setup.py

**学习问题。** 如何实现并注册自定义 Sigmoid C++/CUDA 算子？

**中文讲解。** 完整扩展包含 schema/dispatch 注册、CPU/CUDA 实现、反向公式、构建脚本和 Python autograd 包装；ABI 与 PyTorch/CUDA 版本必须匹配。 高级优化涉及精度、图捕获、动态 shape、编译边界以及 C++/CUDA/Triton 扩展。

**来源文件。** `chapter_09_advanced/custom_op_src/setup.py`

#### 数学、性能模型与算法思路

$$
\sigma(x)=\frac{1}{1+e^{-x}},\qquad \sigma'(x)=\sigma(x)(1-\sigma(x))
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
from setuptools import setup
from torch.utils.cpp_extension import BuildExtension, CppExtension


setup(
    name="custom_ops",
    ext_modules=[
        CppExtension(
            "custom_ops",
            [
                "custom_sigmoid.cpp",
                "custom_sigmoid_cuda.cu",
            ],
            extra_compile_args={"cxx": ["-g"], "nvcc": ["-O2"]},
        )
    ],
    cmdclass={"build_ext": BuildExtension},
)
# [变化示例] 执行状态：调用 setup( name="custom_ops", ext_modules=[ CppExtension( "cust... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 扩展注册：schema 与 CPU/CUDA dispatch 实现必须一致，并为 autograd/compile 提供必要元信息。

#### 输入、输出与验证

- **验证方法。** 先建立 eager 基线，检查 forward/backward 数值，再比较包含与不包含编译时间的性能，并记录 PyTorch/CUDA/编译器版本。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 自定义扩展依赖本机 C++/CUDA toolchain 与 PyTorch ABI；不同 PyTorch 版本的注册接口可能需要调整。

## 218. miniGPT 端到端训练 | 1_tensorboard.py

**学习问题。** 训练循环如何记录 TensorBoard 指标？

**中文讲解。** 使用稳定 tag 和 global_step 写入 loss、吞吐或显存，定期 flush，并避免每步记录大型 histogram。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/1_tensorboard.py`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter(f"gpt_{config.model.model_type}")
# [变化示例] writer=未定义/旧值 -> writer 接收 SummaryWriter(f"gpt_{config.model.model_type}") 的返回值；用 shape/dtype/device 与示例输入核对变化。


...


model = GPT(config.model)
# [变化示例] model=未定义/旧值 -> model 接收 GPT(config.model) 的返回值；用 shape/dtype/device 与示例输入核对变化。
batch = [t.to(trainer.device) for t in next(iter(trainer.train_loader))]
# [变化示例] batch=未定义/旧值 -> batch=[t.to(trainer.device) for t in next(iter(trainer.train_load...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
writer.add_graph(model, batch)
# [变化示例] 执行状态：调用 writer.add_graph(model, batch) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
writer.close()
# [变化示例] 执行状态：调用 writer.close() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。
- TensorBoard：tag 与 global_step 必须稳定，写入频率要控制以免日志 I/O 反过来拖慢训练。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 219. miniGPT 端到端训练 | 2_tensorboard_launch.sh

**学习问题。** 如何启动 TensorBoard 查看日志？

**中文讲解。** logdir 指向事件文件目录；远程环境还需要端口转发和访问控制。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/2_tensorboard_launch.sh`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```bash
tensorboard --logdir gpt_gpt-mini
# [变化示例] 事件日志目录 -> 浏览器可访问的指标页面与监听端口。
```

#### 代码/API 逐项解释

- TensorBoard：tag 与 global_step 必须稳定，写入频率要控制以免日志 I/O 反过来拖慢训练。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 220. miniGPT 端到端训练 | 3_multi_node_config.yaml

**学习问题。** 多节点训练配置需要哪些关键字段？

**中文讲解。** 机器数、每机进程数、rank、主节点地址/端口和启动方式必须在所有节点一致。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/3_multi_node_config.yaml`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```yaml
# 一般存储在`~/.cache/huggingface/accelerate/default_config.yaml`
compute_environment: LOCAL_MACHINE
# [变化示例] 配置 compute_environment=未设置/旧值 -> LOCAL_MACHINE。
debug: false
# [变化示例] 配置 debug=未设置/旧值 -> false。
distributed_type: MULTI_GPU  # 使用多个GPU参与的分布式训练
# [变化示例] 配置 distributed_type=未设置/旧值 -> MULTI_GPU。
downcast_bf16: 'no'
# [变化示例] 配置 downcast_bf16=未设置/旧值 -> 'no'。
enable_cpu_affinity: false
# [变化示例] 配置 enable_cpu_affinity=未设置/旧值 -> false。
machine_rank: 0  # 当前机器的序号为0，注意这个值在不同机器上也是不同的
# [变化示例] 配置 machine_rank=未设置/旧值 -> 0。
main_process_ip: 172.17.0.3  # 主进程的ip地址，可以通过`hostname -I`命令查询
# [变化示例] 配置 main_process_ip=未设置/旧值 -> 172.17.0.3。
main_process_port: 25006  # 主进程任意空闲端口均可
# [变化示例] 配置 main_process_port=未设置/旧值 -> 25006。
main_training_function: main
# [变化示例] 配置 main_training_function=未设置/旧值 -> main。
mixed_precision: 'no'
# [变化示例] 配置 mixed_precision=未设置/旧值 -> 'no'。
num_machines: 2  # 总共有两台机器参与训练
# [变化示例] 配置 num_machines=未设置/旧值 -> 2。
num_processes: 4  # 总共有4个GPU参与训练
# [变化示例] 配置 num_processes=未设置/旧值 -> 4。
rdzv_backend: static
# [变化示例] 配置 rdzv_backend=未设置/旧值 -> static。
same_network: true
# [变化示例] 配置 same_network=未设置/旧值 -> true。
tpu_env: []
# [变化示例] 配置 tpu_env=未设置/旧值 -> []。
tpu_use_cluster: false
# [变化示例] 配置 tpu_use_cluster=未设置/旧值 -> false。
tpu_use_sudo: false
# [变化示例] 配置 tpu_use_sudo=未设置/旧值 -> false。
use_cpu: false
# [变化示例] 配置 use_cpu=未设置/旧值 -> false。
```

#### 代码/API 逐项解释

- 逐行区分配置/命令、实际计算和观测输出；占位符、错误日志或 profiler 结果不能当作通用可执行代码。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 命令依赖 Linux、权限、GPU/驱动或多节点环境；在 Windows 本机不能原样运行。

## 221. miniGPT 端到端训练 | main.py

**学习问题。** miniGPT 端到端入口如何连接数据、模型与训练器？

**中文讲解。** 入口读取文本、建立字符词表与 Dataset、配置 GPT/Trainer、注册回调并启动训练与生成。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/baseline/main.py`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import os
import sys

import torch
import time
import numpy as np

from mingpt.model import GPT
from mingpt.trainer import Trainer
from mingpt.utils import set_seed, setup_logging, CfgNode as CN
from mingpt.char_dataset import CharDataset

from torch.profiler import profile, ProfilerActivity

# -----------------------------------------------------------------------------

def get_config():

    C = CN()
    # [变化示例] C=未定义/旧值 -> C=CN()；这是一次重新绑定/状态更新，右侧值决定新状态。

    # system
    C.system = CN()
    # [变化示例] C.system=未定义/旧值 -> C.system=CN()；这是一次重新绑定/状态更新，右侧值决定新状态。
    C.system.seed = 3407
    # [变化示例] C.system.seed=未定义/旧值 -> C.system.seed=3407；这是一次重新绑定/状态更新，右侧值决定新状态。
    C.system.work_dir = './out/chargpt'
    # [变化示例] C.system.work_dir=未定义/旧值 -> C.system.work_dir='./out/chargpt'；这是一次重新绑定/状态更新，右侧值决定新状态。

    # data
    C.data = CharDataset.get_default_config()
    # [变化示例] C.data=未定义/旧值 -> C.data 接收 CharDataset.get_default_config() 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # model
    C.model = GPT.get_default_config()
    # [变化示例] C.model=未定义/旧值 -> C.model 接收 GPT.get_default_config() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    C.model.model_type = 'gpt-mini'
    # [变化示例] C.model.model_type=未定义/旧值 -> C.model.model_type='gpt-mini'；这是一次重新绑定/状态更新，右侧值决定新状态。

    # configs
    #C.batch_size = 32
    #C.num_workers = 0

    # trainer
    C.trainer = Trainer.get_default_config()
    # [变化示例] C.trainer=未定义/旧值 -> C.trainer 接收 Trainer.get_default_config() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    C.trainer.learning_rate = 5e-4 # the model we're using is so small that we can go a bit faster
    # [变化示例] C.trainer.learning_rate=未定义/旧值 -> C.trainer.learning_rate=5e-4；这是一次重新绑定/状态更新，右侧值决定新状态。

    return C
    # [变化示例] 函数内部：C；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

if __name__ == '__main__':
    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。

    # get default config and overrides from the command line, if any
    config = get_config()
    # [变化示例] config=未定义/旧值 -> config=get_config()；这是一次重新绑定/状态更新，右侧值决定新状态。
    config.merge_from_args(sys.argv[1:])
    # [变化示例] 执行状态：调用 config.merge_from_args(sys.argv[1:]) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    print(config)
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

    setup_logging(config)
    # [变化示例] 执行状态：调用 setup_logging(config) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    set_seed(config.system.seed)
    # [变化示例] 执行状态：调用 set_seed(config.system.seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    # construct the training dataset
    text = open('input.txt', 'r').read() # don't worry we won't run out of file handles
    # [变化示例] text=未定义/旧值 -> text 接收 open('input.txt', 'r').read() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    train_dataset = CharDataset(config.data, text)
    # [变化示例] train_dataset=未定义/旧值 -> train_dataset 接收 CharDataset(config.data, text) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # construct the model
    config.model.vocab_size = train_dataset.get_vocab_size()
    # [变化示例] config.model.vocab_size=未定义/旧值 -> config.model.vocab_size 接收 train_dataset.get_vocab_size() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    config.model.block_size = train_dataset.get_block_size()
    # [变化示例] config.model.block_size=未定义/旧值 -> config.model.block_size 接收 train_dataset.get_block_size() 的返回值；用 shape/dtype/device 与示例输入核对变化。
    model = GPT(config.model)
    # [变化示例] model=未定义/旧值 -> model 接收 GPT(config.model) 的返回值；用 shape/dtype/device 与示例输入核对变化。

    # construct the trainer object
    trainer = Trainer(config.trainer, model, train_dataset)
    # [变化示例] trainer=未定义/旧值 -> trainer 接收 Trainer(config.trainer, model, train_dataset) 的返回值；用 shape/dtype/device 与示例输入核对变化。
    trainer.prepare()
    # [变化示例] 执行状态：调用 trainer.prepare() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    # warm up
    trainer.run(10)
    # [变化示例] 执行状态：调用 trainer.run(10) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。

    # profiler
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        trainer.run(10)
        # [变化示例] 执行状态：调用 trainer.run(10) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    prof.export_chrome_trace(f"0_PROF_original.json")
    # [变化示例] 执行状态：调用 prof.export_chrome_trace(f"0_PROF_original.json") 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.cuda.synchronize()
    # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。

    # evaluate time
    measured_runtimes = []
    # [变化示例] measured_runtimes=未定义/旧值 -> measured_runtimes=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

    num_repeats = 20
    # [变化示例] num_repeats=未定义/旧值 -> num_repeats=20；这是一次重新绑定/状态更新，右侧值决定新状态。
    for i in range(num_repeats):
        # [变化示例] 循环示例：range(num_repeats) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
      start = time.perf_counter()
      # [变化示例] start=未定义/旧值 -> start=单调高分辨率时间戳；end-start -> 代码墙钟耗时。

      trainer.run_num_samples(8192)
      # [变化示例] 执行状态：调用 trainer.run_num_samples(8192) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

      torch.cuda.synchronize()
      # [变化示例] CUDA 状态：stream 中仍有排队工作 -> 等待全部先前工作完成后再继续 host。
      end = time.perf_counter()
      # [变化示例] end=未定义/旧值 -> end=单调高分辨率时间戳；end-start -> 代码墙钟耗时。
      measured_runtimes.append(end - start)
      # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。

    average_runtime = sum(measured_runtimes) / len(measured_runtimes)
    # [变化示例] average_runtime=未定义/旧值 -> average_runtime=sum(measured_runtimes) / len(measured_runtimes)；数值示例：6 / 3 -> 2。
    print("Ave Runtime: ", average_runtime, " seconds")
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
    print("Std: ", np.std(measured_runtimes), " seconds")
    # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 222. miniGPT 端到端训练 | char_dataset.py

**学习问题。** 字符级语言模型 Dataset 如何构造样本？

**中文讲解。** 从长度 block_size+1 的字符窗口生成 x 与右移一位的 y，把 next-token prediction 转成监督学习。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/baseline/mingpt/char_dataset.py`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
import torch
from torch.utils.data import Dataset
from mingpt.utils import CfgNode as CN

class CharDataset(Dataset):
    """
    Emits batches of characters
    """

    @staticmethod
    def get_default_config():
        C = CN()
        # [变化示例] C=未定义/旧值 -> C=CN()；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.block_size = 128
        # [变化示例] C.block_size=未定义/旧值 -> C.block_size=128；这是一次重新绑定/状态更新，右侧值决定新状态。
        return C
        # [变化示例] 函数内部：C；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def __init__(self, config, data):
        self.config = config
        # [变化示例] self.config=未定义/旧值 -> self.config=config；这是一次重新绑定/状态更新，右侧值决定新状态。

        chars = sorted(list(set(data)))
        # [变化示例] chars=未定义/旧值 -> chars 接收 sorted(list(set(data))) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        data_size, vocab_size = len(data), len(chars)
        # [变化示例] data_size, vocab_size=未定义/旧值 -> data_size, vocab_size 接收 len(data), len(chars) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        print('data has %d characters, %d unique.' % (data_size, vocab_size))
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

        self.stoi = { ch:i for i,ch in enumerate(chars) }
        # [变化示例] self.stoi=未定义/旧值 -> self.stoi={ ch:i for i,ch in enumerate(chars) }；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        self.itos = { i:ch for i,ch in enumerate(chars) }
        # [变化示例] self.itos=未定义/旧值 -> self.itos={ i:ch for i,ch in enumerate(chars) }；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        self.vocab_size = vocab_size
        # [变化示例] self.vocab_size=未定义/旧值 -> self.vocab_size=vocab_size；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.data = data
        # [变化示例] self.data=未定义/旧值 -> self.data=data；这是一次重新绑定/状态更新，右侧值决定新状态。

    def get_vocab_size(self):
        return self.vocab_size
        # [变化示例] 函数内部：self.vocab_size；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def get_block_size(self):
        return self.config.block_size
        # [变化示例] 函数内部：self.config.block_size；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def __len__(self):
        return len(self.data) - self.config.block_size
        # [变化示例] 函数内部：len(self.data) - self.config.block_size；数值示例：3 - 2 -> 1 -> 调用方收到该输出。

    def __getitem__(self, idx):
        # grab a chunk of (block_size + 1) characters from the data
        chunk = self.data[idx:idx + self.config.block_size + 1]
        # [变化示例] chunk=未定义/旧值 -> chunk=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
        # encode every character to an integer
        dix = [self.stoi[s] for s in chunk]
        # [变化示例] dix=未定义/旧值 -> dix=[self.stoi[s] for s in chunk]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        # return as tensors
        x = torch.tensor(dix[:-1], dtype=torch.long)
        # [变化示例] x=未定义/旧值 -> x=由给定数据构造的 tensor，并采用显式/推断的 dtype 与 device。
        y = torch.tensor(dix[1:], dtype=torch.long)
        # [变化示例] y=未定义/旧值 -> y=由给定数据构造的 tensor，并采用显式/推断的 dtype 与 device。
        return x, y
        # [变化示例] 函数内部：tuple (x, y)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 223. miniGPT 端到端训练 | model.py

**学习问题。** miniGPT 模型如何实现注意力、Block、损失和生成？

**中文讲解。** token/position embedding 进入多层 causal Transformer；训练输出全位置 logits，生成循环读取最后位置并采样下一个 token。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/baseline/mingpt/model.py`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
"""
Full definition of a GPT Language Model, all of it in this single file.

References:
1) the official GPT-2 TensorFlow implementation released by OpenAI:
https://github.com/openai/gpt-2/blob/master/src/model.py
2) huggingface/transformers PyTorch implementation:
https://github.com/huggingface/transformers/blob/main/src/transformers/models/gpt2/modeling_gpt2.py
"""

import math

import torch
import torch.nn as nn
from torch.nn import functional as F

from mingpt.utils import CfgNode as CN

# -----------------------------------------------------------------------------

class NewGELU(nn.Module):
    """
    Implementation of the GELU activation function currently in Google BERT repo (identical to OpenAI GPT).
    Reference: Gaussian Error Linear Units (GELU) paper: https://arxiv.org/abs/1606.08415
    """
    def forward(self, x):
        return 0.5 * x * (1.0 + torch.tanh(math.sqrt(2.0 / math.pi) * (x + 0.044715 * torch.pow(x, 3.0))))
        # [变化示例] 函数内部：0.5 * x * (1.0 + torch.tanh(math.sqrt(2.0 / math.pi) * (x + 0.0...；数值示例：2 * 3 -> 6 -> 调用方收到该输出。

class CausalSelfAttention(nn.Module):
    """
    A vanilla multi-head masked self-attention layer with a projection at the end.
    It is possible to use torch.nn.MultiheadAttention here but I am including an
    explicit implementation here to show that there is nothing too scary here.
    """

    def __init__(self, config):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        assert config.n_embd % config.n_head == 0
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        # key, query, value projections for all heads, but in a batch
        self.c_attn = nn.Linear(config.n_embd, 3 * config.n_embd)
        # [变化示例] self.c_attn=未定义/旧值 -> self.c_attn=线性映射模块；输入最后一维 config.n_embd -> 输出最后一维 3 * config.n_embd。
        # output projection
        self.c_proj = nn.Linear(config.n_embd, config.n_embd)
        # [变化示例] self.c_proj=未定义/旧值 -> self.c_proj=线性映射模块；输入最后一维 config.n_embd -> 输出最后一维 config.n_embd。
        # regularization
        self.attn_dropout = nn.Dropout(config.attn_pdrop)
        # [变化示例] self.attn_dropout=未定义/旧值 -> self.attn_dropout 接收 nn.Dropout(config.attn_pdrop) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.resid_dropout = nn.Dropout(config.resid_pdrop)
        # [变化示例] self.resid_dropout=未定义/旧值 -> self.resid_dropout 接收 nn.Dropout(config.resid_pdrop) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        # causal mask to ensure that attention is only applied to the left in the input sequence
        self.register_buffer("bias", torch.tril(torch.ones(config.block_size, config.block_size))
                                     .view(1, 1, config.block_size, config.block_size))
        # [变化示例] 执行状态：调用 self.register_buffer("bias", torch.tril(torch.ones(config.b... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.n_head = config.n_head
        # [变化示例] self.n_head=未定义/旧值 -> self.n_head=config.n_head；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.n_embd = config.n_embd
        # [变化示例] self.n_embd=未定义/旧值 -> self.n_embd=config.n_embd；这是一次重新绑定/状态更新，右侧值决定新状态。

    def forward(self, x):
        B, T, C = x.size() # batch size, sequence length, embedding dimensionality (n_embd)
        # [变化示例] B, T, C=未定义/旧值 -> B, T, C=指定轴长度；例如 shape=(2,3,4)，size(dim) -> 对应维长度。

        # calculate query, key, values for all heads in batch and move head forward to be the batch dim
        q, k ,v  = self.c_attn(x).split(self.n_embd, dim=2)
        # [变化示例] q, k ,v=未定义/旧值 -> q, k ,v 接收 self.c_attn(x).split(self.n_embd, dim=2) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2) # (B, nh, T, hs)
        # [变化示例] k=未定义/旧值 -> k 重排为 B, T, self.n_head, C // self.n_head；元素数量与顺序保持不变（若布局允许则共享 storage）。
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2) # (B, nh, T, hs)
        # [变化示例] q=未定义/旧值 -> q 重排为 B, T, self.n_head, C // self.n_head；元素数量与顺序保持不变（若布局允许则共享 storage）。
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2) # (B, nh, T, hs)
        # [变化示例] v=未定义/旧值 -> v 重排为 B, T, self.n_head, C // self.n_head；元素数量与顺序保持不变（若布局允许则共享 storage）。

        # causal self-attention; Self-attend: (B, nh, T, hs) x (B, nh, hs, T) -> (B, nh, T, T)
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
        # [变化示例] att=未定义/旧值 -> att=(q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))；数值示例：2 * 3 -> 6。
        att = att.masked_fill(self.bias[:,:,:T,:T] == 0, float('-inf'))
        # [变化示例] att=未定义/旧值 -> att=mask 后张量；例如 values=[1,2]、mask=[False,True]、fill=-inf -> [1,-inf]。
        att = F.softmax(att, dim=-1)
        # [变化示例] att=未定义/旧值 -> att=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
        att = self.attn_dropout(att)
        # [变化示例] att=未定义/旧值 -> att 接收 self.attn_dropout(att) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        y = att @ v # (B, nh, T, T) x (B, nh, T, hs) -> (B, nh, T, hs)
        # [变化示例] y=未定义/旧值 -> y=矩阵乘法结果；shape 规则 (...,M,K) @ (...,K,N) -> (...,M,N)。
        y = y.transpose(1, 2).contiguous().view(B, T, C) # re-assemble all head outputs side by side
        # [变化示例] y=未定义/旧值 -> y 的轴按 1, 2 重排；例如 (B,S,D) 交换后可变为 (B,D,S)，数值不复制。

        # output projection
        y = self.resid_dropout(self.c_proj(y))
        # [变化示例] y=未定义/旧值 -> y 接收 self.resid_dropout(self.c_proj(y)) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        return y
        # [变化示例] 函数内部：y；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

class Block(nn.Module):
    """ an unassuming Transformer block """

    def __init__(self, config):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        self.ln_1 = nn.LayerNorm(config.n_embd)
        # [变化示例] self.ln_1=未定义/旧值 -> self.ln_1=LayerNorm 模块；例如输入 (...,D) -> 输出仍为 (...,D)，最后一维被归一化。
        self.attn = CausalSelfAttention(config)
        # [变化示例] self.attn=未定义/旧值 -> self.attn 接收 CausalSelfAttention(config) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        self.ln_2 = nn.LayerNorm(config.n_embd)
        # [变化示例] self.ln_2=未定义/旧值 -> self.ln_2=LayerNorm 模块；例如输入 (...,D) -> 输出仍为 (...,D)，最后一维被归一化。
        self.mlp = nn.ModuleDict(dict(
            c_fc    = nn.Linear(config.n_embd, 4 * config.n_embd),
            c_proj  = nn.Linear(4 * config.n_embd, config.n_embd),
            act     = NewGELU(),
            dropout = nn.Dropout(config.resid_pdrop),
        ))
        # [变化示例] self.mlp=未定义/旧值 -> self.mlp=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        m = self.mlp
        # [变化示例] m=未定义/旧值 -> m=self.mlp；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.mlpf = lambda x: m.dropout(m.c_proj(m.act(m.c_fc(x)))) # MLP forward
        # [变化示例] self.mlpf=未定义/旧值 -> self.mlpf=可调用函数；例如传入 z 后，按 x: m.dropout(m.c_proj(m.act(m.c_fc(x)))) 生成输出。

    def forward(self, x):
        x = x + self.attn(self.ln_1(x))
        # [变化示例] x=未定义/旧值 -> x=x + self.attn(self.ln_1(x))；数值示例：2 + 3 -> 5。
        x = x + self.mlpf(self.ln_2(x))
        # [变化示例] x=未定义/旧值 -> x=x + self.mlpf(self.ln_2(x))；数值示例：2 + 3 -> 5。
        return x
        # [变化示例] 函数内部：x；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

class GPT(nn.Module):
    """ GPT Language Model """

    @staticmethod
    def get_default_config():
        C = CN()
        # [变化示例] C=未定义/旧值 -> C=CN()；这是一次重新绑定/状态更新，右侧值决定新状态。
        # either model_type or (n_layer, n_head, n_embd) must be given in the config
        C.model_type = 'gpt'
        # [变化示例] C.model_type=未定义/旧值 -> C.model_type='gpt'；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.n_layer = None
        # [变化示例] C.n_layer=未定义/旧值 -> C.n_layer=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.n_head = None
        # [变化示例] C.n_head=未定义/旧值 -> C.n_head=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.n_embd =  None
        # [变化示例] C.n_embd=未定义/旧值 -> C.n_embd=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        # these options must be filled in externally
        C.vocab_size = None
        # [变化示例] C.vocab_size=未定义/旧值 -> C.vocab_size=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.block_size = None
        # [变化示例] C.block_size=未定义/旧值 -> C.block_size=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        # dropout hyperparameters
        C.embd_pdrop = 0.1
        # [变化示例] C.embd_pdrop=未定义/旧值 -> C.embd_pdrop=0.1；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.resid_pdrop = 0.1
        # [变化示例] C.resid_pdrop=未定义/旧值 -> C.resid_pdrop=0.1；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.attn_pdrop = 0.1
        # [变化示例] C.attn_pdrop=未定义/旧值 -> C.attn_pdrop=0.1；这是一次重新绑定/状态更新，右侧值决定新状态。
        return C
        # [变化示例] 函数内部：C；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def __init__(self, config):
        super().__init__()
        # [变化示例] 执行状态：调用 super().__init__() 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        assert config.vocab_size is not None
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        assert config.block_size is not None
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        self.block_size = config.block_size
        # [变化示例] self.block_size=未定义/旧值 -> self.block_size=config.block_size；这是一次重新绑定/状态更新，右侧值决定新状态。

        type_given = config.model_type is not None
        # [变化示例] type_given=未定义/旧值 -> type_given=config.model_type is not None；这是一次重新绑定/状态更新，右侧值决定新状态。
        params_given = all([config.n_layer is not None, config.n_head is not None, config.n_embd is not None])
        # [变化示例] params_given=未定义/旧值 -> params_given 接收 all([config.n_layer is not None, config.n_head is not None,... 的返回值；用 shape/dtype/device 与示例输入核对变化。
        assert type_given ^ params_given # exactly one of these (XOR)
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        if type_given:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            # translate from model_type to detailed configuration
            config.merge_from_dict({
                # names follow the huggingface naming conventions
                # GPT-1
                'openai-gpt':   dict(n_layer=12, n_head=12, n_embd=768),  # 117M params
                # GPT-2 configs
                'gpt2':         dict(n_layer=12, n_head=12, n_embd=768),  # 124M params
                'gpt2-medium':  dict(n_layer=24, n_head=16, n_embd=1024), # 350M params
                'gpt2-large':   dict(n_layer=36, n_head=20, n_embd=1280), # 774M params
                'gpt2-xl':      dict(n_layer=48, n_head=25, n_embd=1600), # 1558M params
                # Gophers
                'gopher-44m':   dict(n_layer=8, n_head=16, n_embd=512),
                # (there are a number more...)
                # I made these tiny models up
                'gpt-mini':     dict(n_layer=6, n_head=6, n_embd=192),
                'gpt-micro':    dict(n_layer=4, n_head=4, n_embd=128),
                'gpt-nano':     dict(n_layer=3, n_head=3, n_embd=48),
            }[config.model_type])
            # [变化示例] 执行状态：调用 config.merge_from_dict({ 'openai-gpt': dict(n_layer=12, n_h... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

        self.transformer = nn.ModuleDict(dict(
            wte = nn.Embedding(config.vocab_size, config.n_embd),
            wpe = nn.Embedding(config.block_size, config.n_embd),
            drop = nn.Dropout(config.embd_pdrop),
            h = nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
            ln_f = nn.LayerNorm(config.n_embd),
        ))
        # [变化示例] self.transformer=未定义/旧值 -> self.transformer=已注册的子模块容器；普通 Python 列表 -> 可被 state_dict/optimizer 发现的模块集合。
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)
        # [变化示例] self.lm_head=未定义/旧值 -> self.lm_head=线性映射模块；输入最后一维 config.n_embd -> 输出最后一维 config.vocab_size。

        # init all weights, and apply a special scaled init to the residual projections, per GPT-2 paper
        self.apply(self._init_weights)
        # [变化示例] 执行状态：调用 self.apply(self._init_weights) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        for pn, p in self.named_parameters():
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            if pn.endswith('c_proj.weight'):
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                torch.nn.init.normal_(p, mean=0.0, std=0.02/math.sqrt(2 * config.n_layer))
                # [变化示例] 执行状态：调用 torch.nn.init.normal_(p, mean=0.0, std=0.02/math.sqrt(2 * c... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

        # report number of parameters (note we don't count the decoder parameters in lm_head)
        n_params = sum(p.numel() for p in self.transformer.parameters())
        # [变化示例] n_params=未定义/旧值 -> n_params 接收 sum(p.numel() for p in self.transformer.parameters()) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        print("number of parameters: %.2fM" % (n_params/1e6,))
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            # [变化示例] 执行状态：调用 torch.nn.init.normal_(module.weight, mean=0.0, std=0.02) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
            if module.bias is not None:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                torch.nn.init.zeros_(module.bias)
                # [变化示例] 执行状态：调用 torch.nn.init.zeros_(module.bias) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        elif isinstance(module, nn.Embedding):
            # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            # [变化示例] 执行状态：调用 torch.nn.init.normal_(module.weight, mean=0.0, std=0.02) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
        elif isinstance(module, nn.LayerNorm):
            # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
            torch.nn.init.zeros_(module.bias)
            # [变化示例] 执行状态：调用 torch.nn.init.zeros_(module.bias) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
            torch.nn.init.ones_(module.weight)
            # [变化示例] 执行状态：调用 torch.nn.init.ones_(module.weight) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    @classmethod
    def from_pretrained(cls, model_type):
        """
        Initialize a pretrained GPT model by copying over the weights
        from a huggingface/transformers checkpoint.
        """
        assert model_type in {'gpt2', 'gpt2-medium', 'gpt2-large', 'gpt2-xl'}
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        from transformers import GPT2LMHeadModel

        # create a from-scratch initialized minGPT model
        config = cls.get_default_config()
        # [变化示例] config=未定义/旧值 -> config 接收 cls.get_default_config() 的返回值；用 shape/dtype/device 与示例输入核对变化。
        config.model_type = model_type
        # [变化示例] config.model_type=未定义/旧值 -> config.model_type=model_type；这是一次重新绑定/状态更新，右侧值决定新状态。
        config.vocab_size = 50257 # openai's model vocabulary
        # [变化示例] config.vocab_size=未定义/旧值 -> config.vocab_size=50257；这是一次重新绑定/状态更新，右侧值决定新状态。
        config.block_size = 1024  # openai's model block_size
        # [变化示例] config.block_size=未定义/旧值 -> config.block_size=1024；这是一次重新绑定/状态更新，右侧值决定新状态。
        model = GPT(config)
        # [变化示例] model=未定义/旧值 -> model 接收 GPT(config) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        sd = model.state_dict()
        # [变化示例] sd=未定义/旧值 -> sd 接收 model.state_dict() 的返回值；用 shape/dtype/device 与示例输入核对变化。

        # init a huggingface/transformers model
        model_hf = GPT2LMHeadModel.from_pretrained(model_type)
        # [变化示例] model_hf=未定义/旧值 -> model_hf 接收 GPT2LMHeadModel.from_pretrained(model_type) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        sd_hf = model_hf.state_dict()
        # [变化示例] sd_hf=未定义/旧值 -> sd_hf 接收 model_hf.state_dict() 的返回值；用 shape/dtype/device 与示例输入核对变化。

        # copy while ensuring all of the parameters are aligned and match in names and shapes
        keys = [k for k in sd_hf if not k.endswith('attn.masked_bias')] # ignore these
        # [变化示例] keys=未定义/旧值 -> keys=[k for k in sd_hf if not k.endswith('attn.masked_bias')]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        transposed = ['attn.c_attn.weight', 'attn.c_proj.weight', 'mlp.c_fc.weight', 'mlp.c_proj.weight']
        # [变化示例] transposed=未定义/旧值 -> transposed=['attn.c_attn.weight', 'attn.c_proj.weight', 'mlp.c_fc.weig...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        # basically the openai checkpoints use a "Conv1D" module, but we only want to use a vanilla nn.Linear.
        # this means that we have to transpose these weights when we import them
        assert len(keys) == len(sd)
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        for k in keys:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            if any(k.endswith(w) for w in transposed):
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                # special treatment for the Conv1D weights we need to transpose
                assert sd_hf[k].shape[::-1] == sd[k].shape
                # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
                with torch.no_grad():
                    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
                    sd[k].copy_(sd_hf[k].t())
                    # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 sd[k].copy_(sd_hf[k].t()) 后直接覆盖同一 storage。
            else:
                # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                # vanilla copy over the other parameters
                assert sd_hf[k].shape == sd[k].shape
                # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
                with torch.no_grad():
                    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
                    sd[k].copy_(sd_hf[k])
                    # [变化示例] 原地状态：目标 tensor=旧值 -> 执行 sd[k].copy_(sd_hf[k]) 后直接覆盖同一 storage。

        return model
        # [变化示例] 函数内部：model；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def configure_optimizers(self, train_config):
        """
        This long function is unfortunately doing something very simple and is being very defensive:
        We are separating out all parameters of the model into two buckets: those that will experience
        weight decay for regularization and those that won't (biases, and layernorm/embedding weights).
        We are then returning the PyTorch optimizer object.
        """

        # separate out all parameters to those that will and won't experience regularizing weight decay
        decay = set()
        # [变化示例] decay=未定义/旧值 -> decay=set()；这是一次重新绑定/状态更新，右侧值决定新状态。
        no_decay = set()
        # [变化示例] no_decay=未定义/旧值 -> no_decay=set()；这是一次重新绑定/状态更新，右侧值决定新状态。
        whitelist_weight_modules = (torch.nn.Linear, )
        # [变化示例] whitelist_weight_modules=未定义/旧值 -> whitelist_weight_modules=torch.nn.Linear,；这是一次重新绑定/状态更新，右侧值决定新状态。
        blacklist_weight_modules = (torch.nn.LayerNorm, torch.nn.Embedding)
        # [变化示例] blacklist_weight_modules=未定义/旧值 -> blacklist_weight_modules=torch.nn.LayerNorm, torch.nn.Embedding；这是一次重新绑定/状态更新，右侧值决定新状态。
        for mn, m in self.named_modules():
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            for pn, p in m.named_parameters():
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                fpn = '%s.%s' % (mn, pn) if mn else pn # full param name
                # [变化示例] fpn=未定义/旧值 -> fpn=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
                # random note: because named_modules and named_parameters are recursive
                # we will see the same tensors p many many times. but doing it this way
                # allows us to know which parent module any tensor p belongs to...
                if pn.endswith('bias'):
                    # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                    # all biases will not be decayed
                    no_decay.add(fpn)
                    # [变化示例] 执行状态：调用 no_decay.add(fpn) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
                elif pn.endswith('weight') and isinstance(m, whitelist_weight_modules):
                    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                    # weights of whitelist modules will be weight decayed
                    decay.add(fpn)
                    # [变化示例] 执行状态：调用 decay.add(fpn) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
                elif pn.endswith('weight') and isinstance(m, blacklist_weight_modules):
                    # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                    # weights of blacklist modules will NOT be weight decayed
                    no_decay.add(fpn)
                    # [变化示例] 执行状态：调用 no_decay.add(fpn) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

        # validate that we considered every parameter
        param_dict = {pn: p for pn, p in self.named_parameters()}
        # [变化示例] param_dict=未定义/旧值 -> param_dict={pn: p for pn, p in self.named_parameters()}；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        inter_params = decay & no_decay
        # [变化示例] inter_params=未定义/旧值 -> inter_params=decay & no_decay；这是一次重新绑定/状态更新，右侧值决定新状态。
        union_params = decay | no_decay
        # [变化示例] union_params=未定义/旧值 -> union_params=decay | no_decay；这是一次重新绑定/状态更新，右侧值决定新状态。
        assert len(inter_params) == 0, "parameters %s made it into both decay/no_decay sets!" % (str(inter_params), )
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        assert len(param_dict.keys() - union_params) == 0, "parameters %s were not separated into either decay/no_decay set!" \
                                                    % (str(param_dict.keys() - union_params), )
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。

        # create the pytorch optimizer object
        optim_groups = [
            {"params": [param_dict[pn] for pn in sorted(list(decay))], "weight_decay": train_config.weight_decay},
            {"params": [param_dict[pn] for pn in sorted(list(no_decay))], "weight_decay": 0.0},
        ]
        # [变化示例] optim_groups=未定义/旧值 -> optim_groups=[ {"params": [param_dict[pn] for pn in sorted(list(decay))]...；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        optimizer = torch.optim.AdamW(optim_groups, lr=train_config.learning_rate, betas=train_config.betas)
        # [变化示例] optimizer=未定义/旧值 -> optimizer=持有参数引用与状态的优化器；step 前参数 -> step 后按梯度更新。
        return optimizer
        # [变化示例] 函数内部：optimizer；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def forward(self, idx, targets=None):
        device = idx.device
        # [变化示例] device=未定义/旧值 -> device=idx.device；这是一次重新绑定/状态更新，右侧值决定新状态。
        b, t = idx.size()
        # [变化示例] b, t=未定义/旧值 -> b, t=指定轴长度；例如 shape=(2,3,4)，size(dim) -> 对应维长度。
        assert t <= self.block_size, f"Cannot forward sequence of length {t}, block size is only {self.block_size}"
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
        pos = torch.arange(0, t, dtype=torch.long, device=device).unsqueeze(0) # shape (1, t)
        # [变化示例] pos=未定义/旧值 -> pos=等差序列 arange(0, t, dtype=torch.long, device=device)；例如 arange(4) 为 [0,1,2,3]。

        # forward the GPT model itself
        tok_emb = self.transformer.wte(idx) # token embeddings of shape (b, t, n_embd)
        # [变化示例] tok_emb=未定义/旧值 -> tok_emb 接收 self.transformer.wte(idx) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        pos_emb = self.transformer.wpe(pos) # position embeddings of shape (1, t, n_embd)
        # [变化示例] pos_emb=未定义/旧值 -> pos_emb 接收 self.transformer.wpe(pos) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = self.transformer.drop(tok_emb + pos_emb)
        # [变化示例] x=未定义/旧值 -> x 接收 self.transformer.drop(tok_emb + pos_emb) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        for block in self.transformer.h:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            x = block(x)
            # [变化示例] x=未定义/旧值 -> x 接收 block(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        x = self.transformer.ln_f(x)
        # [变化示例] x=未定义/旧值 -> x 接收 self.transformer.ln_f(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。
        logits = self.lm_head(x)
        # [变化示例] logits=未定义/旧值 -> logits 接收 self.lm_head(x) 的返回值；用 shape/dtype/device 与示例输入核对变化。

        # if we are given some desired targets also calculate the loss
        loss = None
        # [变化示例] loss=未定义/旧值 -> loss=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        if targets is not None:
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1)
            # [变化示例] loss=未定义/旧值 -> loss=分类损失/损失模块；例如 logits (B,C) 与 labels (B,) -> 标量平均 loss。

        return logits, loss
        # [变化示例] 函数内部：tuple (logits, loss)；多个值按位置传递/解包，元素本身不被复制 -> 调用方收到该输出。

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, do_sample=False, top_k=None):
        """
        Take a conditioning sequence of indices idx (LongTensor of shape (b,t)) and complete
        the sequence max_new_tokens times, feeding the predictions back into the model each time.
        Most likely you'll want to make sure to be in model.eval() mode of operation for this.
        """
        for _ in range(max_new_tokens):
            # [变化示例] 循环示例：range(max_new_tokens) -> 迭代索引从 0 到上界前一项，每轮执行一次循环体。
            # if the sequence context is growing too long we must crop it at block_size
            idx_cond = idx if idx.size(1) <= self.block_size else idx[:, -self.block_size:]
            # [变化示例] idx_cond=未定义/旧值 -> idx_cond=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
            # forward the model to get the logits for the index in the sequence
            logits, _ = self(idx_cond)
            # [变化示例] logits, _=未定义/旧值 -> logits, _ 接收 self(idx_cond) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            # pluck the logits at the final step and scale by desired temperature
            logits = logits[:, -1, :] / temperature
            # [变化示例] logits=未定义/旧值 -> 先取最后一个时间步，例如 (B,T,V) -> (B,V)，再除 temperature 调整分布尖锐度。
            # optionally crop the logits to only the top k options
            if top_k is not None:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                v, _ = torch.topk(logits, top_k)
                # [变化示例] v, _=未定义/旧值 -> v, _=最大 k 个值/索引；例如 [0.2,0.9,0.4], k=2 -> [0.9,0.4]。
                logits[logits < v[:, [-1]]] = -float('Inf')
                # [变化示例] logits[logits < v[:, [-1]]]=未定义/旧值 -> logits[logits < v[:, [-1]]]=-float('Inf')；这是一次重新绑定/状态更新，右侧值决定新状态。
            # apply softmax to convert logits to (normalized) probabilities
            probs = F.softmax(logits, dim=-1)
            # [变化示例] probs=未定义/旧值 -> probs=归一化概率；例如 logits=[0,1] -> 约 [0.269,0.731]，目标维总和为 1。
            # either sample from the distribution or take the most likely element
            if do_sample:
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                idx_next = torch.multinomial(probs, num_samples=1)
                # [变化示例] idx_next=未定义/旧值 -> idx_next=按概率采样的索引；例如 [0.1,0.9] -> 更可能得到索引 1。
            else:
                # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                _, idx_next = torch.topk(probs, k=1, dim=-1)
                # [变化示例] _, idx_next=未定义/旧值 -> _, idx_next=最大 k 个值/索引；例如 [0.2,0.9,0.4], k=2 -> [0.9,0.4]。
            # append sampled index to the running sequence and continue
            idx = torch.cat((idx, idx_next), dim=1)
            # [变化示例] idx=未定义/旧值 -> idx 沿指定 dim 拼接且该维长度相加；例如 (B,3)+(B,1) -> (B,4)。

        return idx
        # [变化示例] 函数内部：idx；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- 张量创建 API：显式检查 shape、dtype 和 device；训练代码避免无意使用默认 CPU/float32。
- view/reshape/flatten：保持元素总数不变；non-contiguous 输入上 view 可能失败，reshape 可在必要时复制。
- stride/view API：只改变索引到 storage 的映射时不复制数据；as_strided 越界或重叠写入非常危险。
- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。
- 推理上下文：关闭 autograd 记录；inference_mode 进一步减少 view/version tracking。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
- **正确性 / 使用边界。** 这是教学版 GPT：generate 每步重算整个上下文且没有 KV cache，适合学习但不是高性能推理实现。

## 224. miniGPT 端到端训练 | trainer.py

**学习问题。** miniGPT Trainer 如何组织训练步骤？

**中文讲解。** DataLoader 提供 batch，模型计算交叉熵，反向后裁剪梯度并更新 AdamW；callback 解耦日志逻辑。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/baseline/mingpt/trainer.py`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python
"""
Simple training loop; Boilerplate that could apply to any arbitrary neural network,
so nothing in this file really has anything to do with GPT specifically.
"""

import time
from collections import defaultdict

import torch
from torch.utils.data.dataloader import DataLoader
from mingpt.utils import CfgNode as CN
from torch.profiler import profile, record_function, ProfilerActivity

class Trainer:

    @staticmethod
    def get_default_config():
        C = CN()
        # [变化示例] C=未定义/旧值 -> C=CN()；这是一次重新绑定/状态更新，右侧值决定新状态。
        # device to train on
        C.device = 'auto'
        # [变化示例] C.device=未定义/旧值 -> C.device='auto'；这是一次重新绑定/状态更新，右侧值决定新状态。
        # dataloder parameters
        C.num_workers = 0
        # [变化示例] C.num_workers=未定义/旧值 -> C.num_workers=0；这是一次重新绑定/状态更新，右侧值决定新状态。
        # optimizer parameters
        C.max_iters = None
        # [变化示例] C.max_iters=未定义/旧值 -> C.max_iters=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.batch_size = 32
        # [变化示例] C.batch_size=未定义/旧值 -> C.batch_size=32；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.learning_rate = 3e-4
        # [变化示例] C.learning_rate=未定义/旧值 -> C.learning_rate=3e-4；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.betas = (0.9, 0.95)
        # [变化示例] C.betas=未定义/旧值 -> C.betas=tuple (0.9, 0.95)；多个值按位置传递/解包，元素本身不被复制。
        C.weight_decay = 0.1 # only applied on matmul weights
        # [变化示例] C.weight_decay=未定义/旧值 -> C.weight_decay=0.1；这是一次重新绑定/状态更新，右侧值决定新状态。
        C.grad_norm_clip = 1.0
        # [变化示例] C.grad_norm_clip=未定义/旧值 -> C.grad_norm_clip=1.0；这是一次重新绑定/状态更新，右侧值决定新状态。
        return C
        # [变化示例] 函数内部：C；这是一次重新绑定/状态更新，右侧值决定新状态 -> 调用方收到该输出。

    def __init__(self, config, model, train_dataset):
        self.config = config
        # [变化示例] self.config=未定义/旧值 -> self.config=config；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.model = model
        # [变化示例] self.model=未定义/旧值 -> self.model=model；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.optimizer = None
        # [变化示例] self.optimizer=未定义/旧值 -> self.optimizer=None；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.train_dataset = train_dataset
        # [变化示例] self.train_dataset=未定义/旧值 -> self.train_dataset=train_dataset；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.callbacks = defaultdict(list)
        # [变化示例] self.callbacks=未定义/旧值 -> self.callbacks 接收 defaultdict(list) 的返回值；用 shape/dtype/device 与示例输入核对变化。

        # determine the device we'll train on
        if config.device == 'auto':
            # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            # [变化示例] self.device=未定义/旧值 -> self.device=条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式。
        else:
            # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
            self.device = config.device
            # [变化示例] self.device=未定义/旧值 -> self.device=config.device；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.model = self.model.to(self.device)
        # [变化示例] self.model=未定义/旧值 -> self.model 移到目标 device，dtype 保持不变；例如 .to("cuda") 为 CPU float32 -> CUDA float32。
        print("running on device", self.device)
        # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。

        # variables that will be assigned to trainer class later for logging and etc
        self.iter_num = 0
        # [变化示例] self.iter_num=未定义/旧值 -> self.iter_num=0；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.iter_time = 0.0
        # [变化示例] self.iter_time=未定义/旧值 -> self.iter_time=0.0；这是一次重新绑定/状态更新，右侧值决定新状态。
        self.iter_dt = 0.0
        # [变化示例] self.iter_dt=未定义/旧值 -> self.iter_dt=0.0；这是一次重新绑定/状态更新，右侧值决定新状态。

    def add_callback(self, onevent: str, callback):
        self.callbacks[onevent].append(callback)
        # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。

    def set_callback(self, onevent: str, callback):
        self.callbacks[onevent] = [callback]
        # [变化示例] self.callbacks[onevent]=未定义/旧值 -> self.callbacks[onevent]=[callback]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。

    def trigger_callbacks(self, onevent: str):
        for callback in self.callbacks.get(onevent, []):
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            callback(self)
            # [变化示例] 执行状态：调用 callback(self) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    def prepare(self):
        # setup the optimizer
        self.optimizer = self.model.configure_optimizers(self.config)
        # [变化示例] self.optimizer=未定义/旧值 -> self.optimizer 接收 self.model.configure_optimizers(self.config) 的返回值；用 shape/dtype/device 与示例输入核对变化。

        # setup the dataloader
        self.train_loader = DataLoader(
            self.train_dataset,
            sampler=torch.utils.data.RandomSampler(self.train_dataset, replacement=True, num_samples=int(1e10)),
            shuffle=False,
            pin_memory=True,
            batch_size=self.config.batch_size,
            num_workers=self.config.num_workers,
        )
        # [变化示例] self.train_loader=未定义/旧值 -> self.train_loader=批数据迭代器；N 个样本按 batch_size=B -> 约 ceil(N/B) 个 batch。

        self.model.train()
        # [变化示例] 模块模式：旧 train/eval 标志 -> 训练模式，影响 Dropout/BatchNorm。

    def run_num_samples(self, num_samples):
        batch_size = self.config.batch_size
        # [变化示例] batch_size=未定义/旧值 -> batch_size=self.config.batch_size；这是一次重新绑定/状态更新，右侧值决定新状态。
        assert num_samples % batch_size == 0
        # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。

        num_iters = num_samples // batch_size
        # [变化示例] num_iters=未定义/旧值 -> num_iters=num_samples // batch_size；数值示例：7 // 3 -> 2。
        self.run(num_iters)
        # [变化示例] 执行状态：调用 self.run(num_iters) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    def run(self, max_num_iters):
        iter_num = 0
        # [变化示例] iter_num=未定义/旧值 -> iter_num=0；这是一次重新绑定/状态更新，右侧值决定新状态。
        while True:
            # [变化示例] 循环示例：条件 True -> 再执行一轮；条件 False -> 退出循环。
            for batch in self.train_loader:
                # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                with record_function(f"train_{iter_num}"):
                    # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
                    batch = [t.to(self.device) for t in batch]
                    # [变化示例] batch=未定义/旧值 -> batch=[t.to(self.device) for t in batch]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
                    x, y = batch
                    # [变化示例] x, y=未定义/旧值 -> x, y=batch；这是一次重新绑定/状态更新，右侧值决定新状态。

                    # forward the model
                    logits, self.loss = self.model(x, y)
                    # [变化示例] logits, self.loss=未定义/旧值 -> logits, self.loss 接收 self.model(x, y) 的返回值；用 shape/dtype/device 与示例输入核对变化。

                    # backprop and update the parameters
                    self.model.zero_grad(set_to_none=True)
                    # [变化示例] 梯度状态：参数 grad=上一轮值 -> 清零或设为 None，为新一步反向传播做准备。
                    self.loss.backward()
                    # [变化示例] 梯度状态：叶子参数 grad=None/旧梯度 -> 按链式法则得到并累加本轮梯度。
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), self.config.grad_norm_clip)
                    # [变化示例] 执行状态：调用 torch.nn.utils.clip_grad_norm_(self.model.parameters(), sel... 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
                    self.optimizer.step()
                    # [变化示例] 参数状态：theta=更新前参数 -> theta-lr*update；Adam/SGD 的 update 由其状态与当前梯度决定。

                    self.trigger_callbacks('on_batch_end')
                    # [变化示例] 执行状态：调用 self.trigger_callbacks('on_batch_end') 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
                    iter_num += 1
                    # [变化示例] iter_num=旧值 -> iter_num=旧值 + (1)；数值示例：2 + 3 -> 5，并写回 iter_num。

                    if iter_num >= max_num_iters:
                        # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                        return
                        # [变化示例] 函数内部： -> 调用方收到该输出。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- Autograd：backward 按链式法则传播；自定义 Function 必须为每个输入返回 shape 兼容的梯度。
- 原地操作：复用 storage 并更新 version counter；可能破坏 backward 所需中间值或影响别名。
- 计时/Profiler：CUDA 是异步的，host 计时必须同步；profiler 结果还需区分 self 与 total 指标。
- Dataset/DataLoader：Dataset 定义单样本，sampler 定义顺序，worker 并行加载，collate 组成 batch。
- 融合/矩阵 API：优先用批量 tensor 算子表达计算，减少 Python 循环、中间分配和 kernel launch。
- 优化器步骤：清梯度、反向、可选裁剪、step 的顺序必须明确；set_to_none 可减少写零和存储复用。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。

## 225. miniGPT 端到端训练 | utils.py

**学习问题。** miniGPT 配置、日志与随机种子如何管理？

**中文讲解。** 轻量 CfgNode 支持嵌套配置和命令行覆盖，setup_logging 保存参数，set_seed 统一主要 RNG。 把数据集、GPT 模型、优化器、训练循环、TensorBoard 和多节点配置串成完整语言模型系统。

**来源文件。** `chapter_10_mingpt/baseline/mingpt/utils.py`

#### 数学、性能模型与算法思路

$$
\mathcal{L}_{LM}=-\frac{1}{BT}\sum_{b,t}\log p_\theta(x_{b,t+1}\mid x_{b,\le t})
$$

- **先看不变量。** 先确认上式对应的 shape、数据依赖、同步或资源约束，再阅读实现细节。
- **再看执行路径。** 区分 Python 调度、CPU 数据处理、CUDA 异步 kernel、collective 通信和编译阶段，避免把不同时间线混在一起。

### 带逐步变化注释的代码

```python

import os
import sys
import json
import random
from ast import literal_eval

import numpy as np
import torch

# -----------------------------------------------------------------------------

def set_seed(seed):
    random.seed(seed)
    # [变化示例] 执行状态：调用 random.seed(seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    np.random.seed(seed)
    # [变化示例] 执行状态：调用 np.random.seed(seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    torch.manual_seed(seed)
    # [变化示例] RNG 状态：旧随机序列起点 -> 指定 seed 的确定起点；后续相同调用顺序可重放。
    torch.cuda.manual_seed_all(seed)
    # [变化示例] 执行状态：调用 torch.cuda.manual_seed_all(seed) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

def setup_logging(config):
    """ monotonous bookkeeping """
    work_dir = config.system.work_dir
    # [变化示例] work_dir=未定义/旧值 -> work_dir=config.system.work_dir；这是一次重新绑定/状态更新，右侧值决定新状态。
    # create the work directory if it doesn't already exist
    os.makedirs(work_dir, exist_ok=True)
    # [变化示例] 执行状态：调用 os.makedirs(work_dir, exist_ok=True) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    # log the args (if any)
    with open(os.path.join(work_dir, 'args.txt'), 'w') as f:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        f.write(' '.join(sys.argv))
        # [变化示例] 执行状态：调用 f.write(' '.join(sys.argv)) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
    # log the config itself
    with open(os.path.join(work_dir, 'config.json'), 'w') as f:
        # [变化示例] 上下文状态：进入前资源未托管 -> 进入后启用上下文，退出时自动清理/恢复。
        f.write(json.dumps(config.to_dict(), indent=4))
        # [变化示例] 执行状态：调用 f.write(json.dumps(config.to_dict(), indent=4)) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

class CfgNode:
    """ a lightweight configuration class inspired by yacs """
    # TODO: convert to subclass from a dict like in yacs?
    # TODO: implement freezing to prevent shooting of own foot
    # TODO: additional existence/override checks when reading/writing params?

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)
        # [变化示例] 执行状态：调用 self.__dict__.update(kwargs) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    def __str__(self):
        return self._str_helper(0)
        # [变化示例] 函数内部：执行 self._str_helper(0) 得到结果 -> 调用方收到该输出。

    def _str_helper(self, indent):
        """ need to have a helper to support nested indentation for pretty printing """
        parts = []
        # [变化示例] parts=未定义/旧值 -> parts=[]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        for k, v in self.__dict__.items():
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
            if isinstance(v, CfgNode):
                # [变化示例] 分支示例：条件 False -> 跳过该分支；条件 True -> 执行下面缩进代码。
                parts.append("%s:\n" % k)
                # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
                parts.append(v._str_helper(indent + 1))
                # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
            else:
                # [变化示例] 分支示例：前序条件未命中 -> 进入当前分支；已命中 -> 跳过。
                parts.append("%s: %s\n" % (k, v))
                # [变化示例] 容器状态：旧列表 -> 在末尾加入新元素；若元素带 grad_fn，也会延长其计算图生命周期。
        parts = [' ' * (indent * 4) + p for p in parts]
        # [变化示例] parts=未定义/旧值 -> parts=[' ' * (indent * 4) + p for p in parts]；容器按给定元素创建，例如 [1,4] 的长度从 0 -> 2。
        return "".join(parts)
        # [变化示例] 函数内部：执行 "".join(parts) 得到结果 -> 调用方收到该输出。

    def to_dict(self):
        """ return a dict representation of the config """
        return { k: v.to_dict() if isinstance(v, CfgNode) else v for k, v in self.__dict__.items() }
        # [变化示例] 函数内部：条件选择结果；条件 True 取 if 前表达式，False 取 else 后表达式 -> 调用方收到该输出。

    def merge_from_dict(self, d):
        self.__dict__.update(d)
        # [变化示例] 执行状态：调用 self.__dict__.update(d) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。

    def merge_from_args(self, args):
        """
        update the configuration from a list of strings that is expected
        to come from the command line, i.e. sys.argv[1:].

        The arguments are expected to be in the form of `--arg=value`, and
        the arg can use . to denote nested sub-attributes. Example:

        --model.n_layer=10 --trainer.batch_size=32
        """
        for arg in args:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。

            keyval = arg.split('=')
            # [变化示例] keyval=未定义/旧值 -> keyval 接收 arg.split('=') 的返回值；用 shape/dtype/device 与示例输入核对变化。
            assert len(keyval) == 2, "expecting each override arg to be of form --arg=value, got %s" % arg
            # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
            key, val = keyval # unpack
            # [变化示例] key, val=未定义/旧值 -> key, val=keyval；这是一次重新绑定/状态更新，右侧值决定新状态。

            # first translate val into a python object
            try:
                # [变化示例] 异常路径：正常 -> 执行 try；发生匹配异常 -> 跳转到对应 except。
                val = literal_eval(val)
                # [变化示例] val=未定义/旧值 -> val 接收 literal_eval(val) 的返回值；用 shape/dtype/device 与示例输入核对变化。
                """
                need some explanation here.
                - if val is simply a string, literal_eval will throw a ValueError
                - if val represents a thing (like an 3, 3.14, [1,2,3], False, None, etc.) it will get created
                """
            except ValueError:
                # [变化示例] 异常路径：捕获到匹配异常 -> 执行恢复/报告逻辑；否则不进入。
                pass

            # find the appropriate object to insert the attribute into
            assert key[:2] == '--'
            # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。
            key = key[2:] # strip the '--'
            # [变化示例] key=未定义/旧值 -> key=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。
            keys = key.split('.')
            # [变化示例] keys=未定义/旧值 -> keys 接收 key.split('.') 的返回值；用 shape/dtype/device 与示例输入核对变化。
            obj = self
            # [变化示例] obj=未定义/旧值 -> obj=self；这是一次重新绑定/状态更新，右侧值决定新状态。
            for k in keys[:-1]:
            # [变化示例] 循环示例：可迭代对象 [a,b] -> 循环变量依次为 a、b，并执行两轮循环体。
                obj = getattr(obj, k)
                # [变化示例] obj=未定义/旧值 -> obj 接收 getattr(obj, k) 的返回值；用 shape/dtype/device 与示例输入核对变化。
            leaf_key = keys[-1]
            # [变化示例] leaf_key=未定义/旧值 -> leaf_key=索引/切片结果；例如 x.shape=(10,20)，x[0] -> shape=(20,)。

            # ensure that this attribute exists
            assert hasattr(obj, leaf_key), f"{key} is not an attribute that exists in the config"
            # [变化示例] 校验变化：条件为 True -> 程序继续；条件为 False -> 立即抛出 AssertionError。

            # overwrite the attribute
            print("command line overwriting config attribute %s with %s" % (key, val))
            # [变化示例] 可观察变化：内存中的变量/指标 -> 写到标准输出；print 本身不改变 tensor 数值。
            setattr(obj, leaf_key, val)
            # [变化示例] 执行状态：调用 setattr(obj, leaf_key, val) 前 -> 调用完成；若是原地/日志/同步 API，会更新对应状态。
```

#### 代码/API 逐项解释

- 索引与 mask：基础索引多为 view，高级索引读取多为 copy；整数索引会删除维度。
- 复现配置：Python、NumPy、PyTorch 和 CUDA 算法选择需要一起控制，seed 不是完全确定性的充分条件。
- NumPy 互操作：from_numpy 常共享 CPU 内存；dtype、stride、线程池和隐式复制会影响正确性与性能。

#### 输入、输出与验证

- **验证方法。** 先在短文本上确认 x/y 右移、logits shape、loss 下降和可生成字符，再逐步加入 profiler、AMP、DDP 等优化。
- **运行环境。** 该示例来自课程源码；需要按代码中的 CUDA、Linux、第三方包和数据路径要求准备环境，不应假设在当前 Windows 主机可直接运行。
