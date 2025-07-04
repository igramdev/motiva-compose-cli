import { LLMProviderManager } from './src/lib/llm-provider.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import { ConceptPlanner } from './src/agents/concept-planner.js';
import chalk from 'chalk';

async function testAPI() {
  console.log(chalk.blue('🚀 APIテストを開始します...'));
  
  try {
    // LLMプロバイダーマネージャーを初期化
    const llmManager = new LLMProviderManager();
    
    // 利用可能なプロバイダーを表示
    console.log(chalk.yellow('📋 利用可能なプロバイダー:'));
    llmManager.showProviderInfo();
    
    // 利用可能なプロバイダーを取得
    const availableProviders = llmManager.getAvailableProviders();
    let testProvider = availableProviders[0];
    
    if (availableProviders.length === 0) {
      console.log(chalk.red('❌ 利用可能なプロバイダーがありません'));
      return;
    }
    
    // モックプロバイダーを優先
    const mockProvider = availableProviders.find(p => p.name === 'mock');
    if (mockProvider) {
      testProvider = mockProvider;
      console.log(chalk.yellow('🧪 モックプロバイダーを使用してテストを実行します'));
    } else {
      console.log(chalk.green(`✅ ${testProvider.name}プロバイダーが利用可能です`));
    }
    
    // 簡単なテキスト生成テスト
    console.log(chalk.blue('🧪 テキスト生成テスト...'));
    const textResponse = await testProvider.generateText({
      model: 'gpt-4o-mini',
      systemPrompt: 'あなたは親切なアシスタントです。',
      userInput: 'こんにちは！簡単な挨拶をしてください。',
      temperature: 0.7
    });
    
    console.log(chalk.green('📝 生成されたテキスト:'));
    console.log(textResponse.data);
    console.log(chalk.gray(`💰 コスト: $${textResponse.costUSD.toFixed(6)}`));
    console.log(chalk.gray(`🪙 使用トークン: ${textResponse.tokensUsed}`));
    console.log(chalk.gray(`⏱️ 実行時間: ${textResponse.duration}ms`));
    
    // JSON生成テスト
    console.log(chalk.blue('🧪 JSON生成テスト...'));
    const { z } = await import('zod');
    
    const jsonResponse = await testProvider.generateJSON({
      model: 'gpt-4o-mini',
      systemPrompt: 'あなたはJSONを生成するアシスタントです。',
      userInput: '映画のタイトルとジャンルを含むJSONを生成してください。',
      temperature: 0.7,
      responseFormat: 'json_object'
    }, z.object({
      title: z.string(),
      genre: z.string(),
      description: z.string()
    }));
    
    console.log(chalk.green('📋 生成されたJSON:'));
    console.log(JSON.stringify(jsonResponse.data, null, 2));
    console.log(chalk.gray(`💰 コスト: $${jsonResponse.costUSD.toFixed(6)}`));
    console.log(chalk.gray(`🪙 使用トークン: ${jsonResponse.tokensUsed}`));
    console.log(chalk.gray(`⏱️ 実行時間: ${jsonResponse.duration}ms`));
    
    // エージェントテスト
    console.log(chalk.blue('🧪 エージェントテスト...'));
    
    const budgetManager = new DualBudgetManager();
    const conceptPlanner = new ConceptPlanner(budgetManager);
    
    // 簡単なショットプラン生成テスト
    console.log(chalk.blue('🧪 ショットプラン生成テスト...'));
    
    const shotPlan = await conceptPlanner.generatePlan('宇宙をテーマにした短編映画', {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2048
    });
    
    console.log(chalk.green('✅ ショットプラン生成完了:'));
    console.log(JSON.stringify(shotPlan, null, 2));
    
    console.log(chalk.green('🎉 すべてのテストが完了しました！'));
    
  } catch (error) {
    console.error(chalk.red('❌ テスト中にエラーが発生しました:'));
    console.error(error);
  }
}

// テスト実行
testAPI().catch(console.error); 