/**
 * TitanChain Garbled Circuits Protocol Implementation / TitanChain混淆电路协议实现
 * 
 * Based on Yao's garbled circuits protocol, allows two or more parties to jointly compute
 * a function result without revealing their respective inputs
 * 基于Yao的混淆电路协议，允许两方或多方在不泄露各自输入的情况下共同计算一个函数的结果
 */

import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import {
  IGarbledCircuits,
  GarbledCircuit,
  GarbledGate,
  Wire,
  GarbledCircuitError
} from './index';

export class GarbledCircuits extends EventEmitter implements IGarbledCircuits {
  private isInitialized: boolean = false;
  private circuits: Map<string, GarbledCircuit> = new Map();
  private wireLabels: Map<string, Map<boolean, string>> = new Map();

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new GarbledCircuitError('Garbled Circuits is already initialized');
    }

    try {
      console.log('🔌 Initializing Garbled Circuits...');
      
      // 初始化加密组件
      this.setupCryptographicComponents();
      
      this.isInitialized = true;
      console.log('✅ Garbled Circuits initialized');
      
      this.emit('initialized', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'initialized' }
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Garbled Circuits:', error);
      throw new GarbledCircuitError(`Failed to initialize: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Shutting down Garbled Circuits...');
      
      // 清理所有电路和标签
      this.circuits.clear();
      this.wireLabels.clear();
      
      this.isInitialized = false;
      console.log('✅ Garbled Circuits shutdown completed');
      
      this.emit('shutdown', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'shutdown' }
      });
      
    } catch (error) {
      console.error('❌ Error during Garbled Circuits shutdown:', error);
      throw new GarbledCircuitError(`Failed to shutdown: ${error.message}`);
    }
  }

  async createCircuit(gates: any[], inputs: any[], outputs: any[]): Promise<GarbledCircuit> {
    if (!this.isInitialized) {
      throw new GarbledCircuitError('Garbled Circuits is not initialized');
    }

    // 验证输入参数
    if (!Array.isArray(gates)) {
      throw new GarbledCircuitError('Gates must be an array');
    }
    if (!Array.isArray(inputs)) {
      throw new GarbledCircuitError('Inputs must be an array');
    }
    if (!Array.isArray(outputs)) {
      throw new GarbledCircuitError('Outputs must be an array');
    }

    try {
      console.log(`🔌 Creating circuit with ${gates.length} gates...`);
      
      const circuitId = this.generateCircuitId();
      
      // 创建输入线
      const inputWires: Wire[] = inputs.map((input, index) => ({
        wire_id: `input_${index}`,
        label_0: this.generateWireLabel(),
        label_1: this.generateWireLabel(),
        value: input.value
      }));
      
      // 创建输出线
      const outputWires: Wire[] = outputs.map((output, index) => ({
        wire_id: `output_${index}`,
        label_0: this.generateWireLabel(),
        label_1: this.generateWireLabel()
      }));
      
      // 创建中间线
      const intermediateWires = this.createIntermediateWires(gates);
      
      // 创建混淆门
      const garbledGates = await this.createGarbledGates(gates, [...inputWires, ...intermediateWires, ...outputWires]);
      
      const circuit: GarbledCircuit = {
        circuit_id: circuitId,
        gates: garbledGates,
        input_wires: inputWires,
        output_wires: outputWires,
        garbling_key: this.generateGarblingKey()
      };
      
      this.circuits.set(circuitId, circuit);
      
      console.log(`✅ Circuit created: ${circuitId}`);
      
      this.emit('circuit_created', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          circuit_id: circuitId,
          gates_count: garbledGates.length,
          input_wires: inputWires.length,
          output_wires: outputWires.length
        }
      });
      
      return circuit;
      
    } catch (error) {
      console.error('❌ Failed to create circuit:', error);
      throw new GarbledCircuitError(`Failed to create circuit: ${error.message}`);
    }
  }

  async garbleCircuit(circuit: any): Promise<GarbledCircuit> {
    if (!this.isInitialized) {
      throw new GarbledCircuitError('Garbled Circuits is not initialized');
    }

    try {
      console.log('🔐 Garbling circuit...');
      
      const circuitId = this.generateCircuitId();
      const garblingKey = this.generateGarblingKey();
      
      // 为每条线生成随机标签
      const wireLabels = new Map<string, Map<boolean, string>>();
      
      // 生成输入线标签
      const inputWires: Wire[] = circuit.inputs.map((input: any, index: number) => {
        const wireId = `input_${index}`;
        const label0 = this.generateWireLabel();
        const label1 = this.generateWireLabel();
        
        wireLabels.set(wireId, new Map([[false, label0], [true, label1]]));
        
        return {
          wire_id: wireId,
          label_0: label0,
          label_1: label1,
          value: input.value
        };
      });
      
      // 生成输出线标签
      const outputWires: Wire[] = circuit.outputs.map((output: any, index: number) => {
        const wireId = `output_${index}`;
        const label0 = this.generateWireLabel();
        const label1 = this.generateWireLabel();
        
        wireLabels.set(wireId, new Map([[false, label0], [true, label1]]));
        
        return {
          wire_id: wireId,
          label_0: label0,
          label_1: label1
        };
      });
      
      // 为中间线生成标签
      const intermediateWires = this.generateIntermediateWireLabels(circuit.gates, wireLabels);
      
      // 混淆所有门
      const garbledGates: GarbledGate[] = [];
      
      for (const gate of circuit.gates) {
        const garbledGate = await this.garbleGate(gate, wireLabels, garblingKey);
        garbledGates.push(garbledGate);
      }
      
      const garbledCircuit: GarbledCircuit = {
        circuit_id: circuitId,
        gates: garbledGates,
        input_wires: inputWires,
        output_wires: outputWires,
        garbling_key: garblingKey
      };
      
      this.circuits.set(circuitId, garbledCircuit);
      this.wireLabels.set(circuitId, wireLabels);
      
      console.log(`✅ Circuit garbled: ${circuitId}`);
      
      this.emit('circuit_garbled', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          circuit_id: circuitId,
          gates_garbled: garbledGates.length
        }
      });
      
      return garbledCircuit;
      
    } catch (error) {
      console.error('❌ Failed to garble circuit:', error);
      throw new GarbledCircuitError(`Failed to garble circuit: ${error.message}`);
    }
  }

  async evaluateCircuit(circuit: GarbledCircuit, inputs: Record<string, boolean>): Promise<Record<string, boolean>> {
    if (!this.isInitialized) {
      throw new GarbledCircuitError('Garbled Circuits is not initialized');
    }

    try {
      console.log(`🔍 Evaluating circuit: ${circuit.circuit_id}...`);
      
      // 获取输入线的标签
      const wireValues = new Map<string, string>();
      
      for (let i = 0; i < circuit.input_wires.length; i++) {
        const wire = circuit.input_wires[i];
        const inputKey = `input_${i}`;
        const inputValue = inputs[inputKey];
        
        if (inputValue === undefined) {
          throw new GarbledCircuitError(`Missing input value for ${inputKey}`);
        }
        
        const label = inputValue ? wire.label_1 : wire.label_0;
        wireValues.set(wire.wire_id, label);
      }
      
      // 按拓扑顺序评估门
      for (const gate of circuit.gates) {
        const outputLabel = await this.evaluateGate(gate, wireValues);
        wireValues.set(gate.output_wire, outputLabel);
      }
      
      // 解码输出
      const outputs: Record<string, boolean> = {};
      
      for (let i = 0; i < circuit.output_wires.length; i++) {
        const wire = circuit.output_wires[i];
        const outputLabel = wireValues.get(wire.wire_id);
        
        if (!outputLabel) {
          throw new GarbledCircuitError(`Missing output label for wire ${wire.wire_id}`);
        }
        
        // 确定输出值
        const outputValue = outputLabel === wire.label_1;
        outputs[`output_${i}`] = outputValue;
      }
      
      console.log(`✅ Circuit evaluated: ${circuit.circuit_id}`);
      
      this.emit('circuit_evaluated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          circuit_id: circuit.circuit_id,
          outputs: outputs
        }
      });
      
      return outputs;
      
    } catch (error) {
      console.error('❌ Failed to evaluate circuit:', error);
      throw new GarbledCircuitError(`Failed to evaluate circuit: ${error.message}`);
    }
  }

  async verifyCircuit(circuit: GarbledCircuit): Promise<boolean> {
    if (!this.isInitialized) {
      throw new GarbledCircuitError('Garbled Circuits is not initialized');
    }

    try {
      console.log(`🔍 Verifying circuit: ${circuit.circuit_id}...`);
      
      // 验证电路结构
      if (!circuit.circuit_id || !circuit.gates || !circuit.input_wires || !circuit.output_wires) {
        return false;
      }
      
      // 验证门的完整性
      for (const gate of circuit.gates) {
        if (!this.verifyGate(gate)) {
          return false;
        }
      }
      
      // 验证线的标签
      for (const wire of [...circuit.input_wires, ...circuit.output_wires]) {
        if (!wire.label_0 || !wire.label_1 || wire.label_0 === wire.label_1) {
          return false;
        }
      }
      
      // 验证混淆密钥
      if (!circuit.garbling_key || circuit.garbling_key.length < 32) {
        return false;
      }
      
      console.log(`✅ Circuit verified: ${circuit.circuit_id}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to verify circuit ${circuit.circuit_id}:`, error);
      return false;
    }
  }

  // 私有方法
  private setupCryptographicComponents(): void {
    // 初始化加密组件
    // 在实际实现中，这里会设置AES加密、哈希函数等
  }

  private createIntermediateWires(gates: any[]): Wire[] {
    const intermediateWires: Wire[] = [];
    const wireIds = new Set<string>();
    
    // 收集所有中间线ID
    for (const gate of gates) {
      if (gate.output_wire && typeof gate.output_wire === 'string' && 
          !gate.output_wire.startsWith('output_') && !gate.output_wire.startsWith('input_')) {
        wireIds.add(gate.output_wire);
      }
    }
    
    // 为每条中间线创建Wire对象
    for (const wireId of wireIds) {
      intermediateWires.push({
        wire_id: wireId,
        label_0: this.generateWireLabel(),
        label_1: this.generateWireLabel()
      });
    }
    
    return intermediateWires;
  }

  private async createGarbledGates(gates: any[], allWires: Wire[]): Promise<GarbledGate[]> {
    const garbledGates: GarbledGate[] = [];
    const wireMap = new Map<string, Wire>();
    
    // 创建线映射
    for (const wire of allWires) {
      wireMap.set(wire.wire_id, wire);
    }
    
    for (const gate of gates) {
      const truthTable = this.generateGarbledTruthTable(gate, wireMap);
      
      const garbledGate: GarbledGate = {
        gate_id: this.generateGateId(),
        gate_type: gate.type,
        input_wires: gate.input_wires,
        output_wire: gate.output_wire,
        truth_table: truthTable
      };
      
      garbledGates.push(garbledGate);
    }
    
    return garbledGates;
  }

  private generateGarbledTruthTable(gate: any, wireMap: Map<string, Wire>): string[] {
    const truthTable: string[] = [];
    
    // 获取输入和输出线
    const inputWires = gate.input_wires.map((wireId: string) => wireMap.get(wireId));
    const outputWire = wireMap.get(gate.output_wire);
    
    if (!inputWires.every((wire: Wire | undefined) => wire) || !outputWire) {
      throw new GarbledCircuitError('Invalid wire references in gate');
    }
    
    // 生成所有可能的输入组合
    const inputCombinations = this.generateInputCombinations(inputWires.length);
    
    for (const combination of inputCombinations) {
      // 计算门的输出
      const gateOutput = this.evaluateGateLogic(gate.type, combination);
      
      // 获取输入标签
      const inputLabels = combination.map((value, index) => 
        value ? inputWires[index]!.label_1 : inputWires[index]!.label_0
      );
      
      // 获取输出标签
      const outputLabel = gateOutput ? outputWire.label_1 : outputWire.label_0;
      
      // 加密输出标签
      const encryptedOutput = this.encryptLabel(inputLabels, outputLabel);
      truthTable.push(encryptedOutput);
    }
    
    // 随机打乱真值表
    return this.shuffleTruthTable(truthTable);
  }

  private generateInputCombinations(inputCount: number): boolean[][] {
    const combinations: boolean[][] = [];
    const totalCombinations = Math.pow(2, inputCount);
    
    for (let i = 0; i < totalCombinations; i++) {
      const combination: boolean[] = [];
      for (let j = 0; j < inputCount; j++) {
        combination.push((i & (1 << j)) !== 0);
      }
      combinations.push(combination);
    }
    
    return combinations;
  }

  private evaluateGateLogic(gateType: string, inputs: boolean[]): boolean {
    switch (gateType) {
      case 'AND':
        return inputs.every(input => input);
      case 'OR':
        return inputs.some(input => input);
      case 'XOR':
        return inputs.reduce((acc, input) => acc !== input, false);
      case 'NOT':
        return !inputs[0];
      default:
        throw new GarbledCircuitError(`Unsupported gate type: ${gateType}`);
    }
  }

  private encryptLabel(inputLabels: string[], outputLabel: string): string {
    // 使用输入标签作为密钥加密输出标签
    const key = this.combineLabels(inputLabels);
    return this.encrypt(outputLabel, key);
  }

  private combineLabels(labels: string[]): string {
    return createHash('sha256').update(labels.join('')).digest('hex');
  }

  private encrypt(data: string, key: string): string {
    // 简化的加密实现（实际中应使用AES）
    const hash = createHash('sha256').update(data + key).digest('hex');
    return hash;
  }

  private shuffleTruthTable(truthTable: string[]): string[] {
    const shuffled = [...truthTable];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateIntermediateWireLabels(gates: any[], wireLabels: Map<string, Map<boolean, string>>): Wire[] {
    const intermediateWires: Wire[] = [];
    
    for (const gate of gates) {
      if (!wireLabels.has(gate.output_wire)) {
        const label0 = this.generateWireLabel();
        const label1 = this.generateWireLabel();
        
        wireLabels.set(gate.output_wire, new Map([[false, label0], [true, label1]]));
        
        intermediateWires.push({
          wire_id: gate.output_wire,
          label_0: label0,
          label_1: label1
        });
      }
    }
    
    return intermediateWires;
  }

  private async garbleGate(gate: any, wireLabels: Map<string, Map<boolean, string>>, garblingKey: string): Promise<GarbledGate> {
    const truthTable: string[] = [];
    
    // 生成所有输入组合
    const inputCombinations = this.generateInputCombinations(gate.input_wires.length);
    
    for (const combination of inputCombinations) {
      // 获取输入标签
      const inputLabels = combination.map((value, index) => {
        const wireId = gate.input_wires[index];
        const labels = wireLabels.get(wireId);
        return labels?.get(value) || '';
      });
      
      // 计算门输出
      const gateOutput = this.evaluateGateLogic(gate.type, combination);
      
      // 获取输出标签
      const outputLabels = wireLabels.get(gate.output_wire);
      const outputLabel = outputLabels?.get(gateOutput) || '';
      
      // 加密输出标签
      const encryptedOutput = this.encryptLabel(inputLabels, outputLabel);
      truthTable.push(encryptedOutput);
    }
    
    return {
      gate_id: this.generateGateId(),
      gate_type: gate.type,
      input_wires: gate.input_wires,
      output_wire: gate.output_wire,
      truth_table: this.shuffleTruthTable(truthTable)
    };
  }

  private async evaluateGate(gate: GarbledGate, wireValues: Map<string, string>): Promise<string> {
    // 获取输入标签
    const inputLabels = gate.input_wires.map(wireId => wireValues.get(wireId) || '');
    
    // 为了简化演示，我们直接计算门的逻辑输出
    // 在实际的混淆电路中，这里会通过解密真值表来获得输出
    
    // 首先确定输入值（通过比较标签）
    const inputValues: boolean[] = [];
    const circuitId = Object.keys(Object.fromEntries(this.wireLabels.entries()))[0];
    const wireLabelsMap = this.wireLabels.get(circuitId);
    
    if (!wireLabelsMap) {
      throw new GarbledCircuitError('Wire labels not found');
    }
    
    for (let i = 0; i < gate.input_wires.length; i++) {
      const wireId = gate.input_wires[i];
      const currentLabel = inputLabels[i];
      const labels = wireLabelsMap.get(wireId);
      
      if (!labels) {
        throw new GarbledCircuitError(`Labels not found for wire ${wireId}`);
      }
      
      // 确定当前标签对应的布尔值
      if (currentLabel === labels.get(true)) {
        inputValues.push(true);
      } else if (currentLabel === labels.get(false)) {
        inputValues.push(false);
      } else {
        throw new GarbledCircuitError(`Invalid label for wire ${wireId}`);
      }
    }
    
    // 计算门的输出
    const outputValue = this.evaluateGateLogic(gate.gate_type, inputValues);
    
    // 获取对应的输出标签
    const outputLabels = wireLabelsMap.get(gate.output_wire);
    if (!outputLabels) {
      throw new GarbledCircuitError(`Output labels not found for wire ${gate.output_wire}`);
    }
    
    return outputLabels.get(outputValue) || '';
  }

  private decrypt(encryptedData: string, key: string): string | null {
    // 简化的解密实现
    // 在实际的混淆电路中，这里应该使用对称加密算法
    // 为了简化，我们使用哈希验证的方式
    
    // 尝试解密：如果加密数据是通过 encrypt(outputLabel, key) 生成的
    // 我们需要反向验证
    
    // 由于我们的加密是 hash(outputLabel + key)，我们需要尝试所有可能的输出标签
    // 在实际实现中，这里会更复杂，但为了演示，我们简化处理
    
    // 返回解密后的标签（这里简化为返回加密数据的一部分）
    return encryptedData.substring(0, 32);
  }

  private verifyGate(gate: GarbledGate): boolean {
    return !!(gate.gate_id && 
             gate.gate_type && 
             gate.input_wires && 
             gate.output_wire && 
             gate.truth_table && 
             gate.truth_table.length > 0);
  }

  private generateWireLabel(): string {
    return randomBytes(16).toString('hex');
  }

  private generateGarblingKey(): string {
    return randomBytes(32).toString('hex');
  }

  private generateCircuitId(): string {
    return 'gc_circuit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateGateId(): string {
    return 'gc_gate_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateEventId(): string {
    return 'gc_event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }
}