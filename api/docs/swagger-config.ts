/**
 * Swagger/OpenAPI Configuration / Swagger/OpenAPI配置
 * Auto-generates API documentation from route definitions / 从路由定义自动生成API文档
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { ApiResponse, HTTP_STATUS, API_CATEGORIES } from '../../shared/types/api';

// OpenAPI Specification / OpenAPI规范
export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'TitanChain API',
    version: '1.0.0',
    description: 'TitanChain区块链平台API文档 / TitanChain Blockchain Platform API Documentation',
    contact: {
      name: 'TitanChain Team',
      email: 'api@titanchain.io'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server / 开发服务器'
    },
    {
      url: 'https://api.titanchain.io',
      description: 'Production server / 生产服务器'
    }
  ],
  components: {
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Request success status / 请求成功状态'
          },
          data: {
            description: 'Response data / 响应数据'
          },
          error: {
            type: 'string',
            description: 'Error message if failed / 失败时的错误消息'
          },
          message: {
            type: 'string',
            description: 'Additional message / 附加消息'
          },
          timestamp: {
            type: 'number',
            description: 'Response timestamp / 响应时间戳'
          },
          requestId: {
            type: 'string',
            description: 'Request tracking ID / 请求跟踪ID'
          }
        },
        required: ['success', 'timestamp']
      },
      PaginatedResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  hasNext: { type: 'boolean' },
                  hasPrev: { type: 'boolean' }
                }
              }
            }
          }
        ]
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [false]
          },
          error: {
            type: 'string',
            description: 'Error message / 错误消息'
          },
          errorCode: {
            type: 'string',
            description: 'Error code / 错误代码'
          },
          details: {
            description: 'Error details / 错误详情'
          },
          timestamp: {
            type: 'number'
          },
          requestId: {
            type: 'string'
          }
        },
        required: ['success', 'error', 'timestamp']
      },
      HealthCheckResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy']
          },
          timestamp: { type: 'number' },
          uptime: { type: 'number' },
          version: { type: 'string' },
          services: {
            type: 'object',
            additionalProperties: {
              $ref: '#/components/schemas/ServiceHealth'
            }
          }
        }
      },
      ServiceHealth: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy']
          },
          responseTime: { type: 'number' },
          lastCheck: { type: 'number' },
          error: { type: 'string' }
        }
      },
      BlockchainStats: {
        type: 'object',
        properties: {
          blockHeight: { type: 'number' },
          totalTransactions: { type: 'number' },
          activeValidators: { type: 'number' },
          networkHashRate: { type: 'string' },
          avgBlockTime: { type: 'number' },
          totalSupply: { type: 'string' }
        }
      },
      Transaction: {
        type: 'object',
        properties: {
          hash: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          value: { type: 'string' },
          gasPrice: { type: 'string' },
          gasLimit: { type: 'number' },
          nonce: { type: 'number' },
          timestamp: { type: 'number' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'failed']
          }
        }
      },
      Block: {
        type: 'object',
        properties: {
          hash: { type: 'string' },
          number: { type: 'number' },
          parentHash: { type: 'string' },
          timestamp: { type: 'number' },
          miner: { type: 'string' },
          difficulty: { type: 'string' },
          gasUsed: { type: 'number' },
          gasLimit: { type: 'number' },
          transactions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transaction' }
          }
        }
      },
      Validator: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          address: { type: 'string' },
          stake: { type: 'string' },
          commission: { type: 'number' },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'jailed']
          },
          uptime: { type: 'number' },
          lastSeen: { type: 'number' }
        }
      }
    },
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required / 需要身份验证',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      ForbiddenError: {
        description: 'Insufficient permissions / 权限不足',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found / 资源未找到',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      ValidationError: {
        description: 'Invalid input data / 输入数据无效',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit exceeded / 超出速率限制',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      ServerError: {
        description: 'Internal server error / 服务器内部错误',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check / 健康检查',
        description: 'Check system health status / 检查系统健康状态',
        responses: {
          '200': {
            description: 'System is healthy / 系统健康',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheckResponse' }
              }
            }
          }
        }
      }
    },
    '/api/blockchain/stats': {
      get: {
        tags: ['Blockchain'],
        summary: 'Get blockchain statistics / 获取区块链统计信息',
        description: 'Retrieve current blockchain network statistics / 获取当前区块链网络统计信息',
        responses: {
          '200': {
            description: 'Blockchain statistics / 区块链统计信息',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/BlockchainStats' }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'Get transactions / 获取交易列表',
        description: 'Retrieve paginated list of transactions / 获取分页的交易列表',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number', default: 1 },
            description: 'Page number / 页码'
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number', default: 20, maximum: 100 },
            description: 'Items per page / 每页项目数'
          },
          {
            name: 'address',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by address / 按地址过滤'
          }
        ],
        responses: {
          '200': {
            description: 'Transaction list / 交易列表',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/PaginatedResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Transaction' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      post: {
        tags: ['Transactions'],
        summary: 'Submit transaction / 提交交易',
        description: 'Submit a new transaction to the network / 向网络提交新交易',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  to: { type: 'string', description: 'Recipient address / 接收方地址' },
                  value: { type: 'string', description: 'Transaction value / 交易金额' },
                  gasPrice: { type: 'string', description: 'Gas price / Gas价格' },
                  gasLimit: { type: 'number', description: 'Gas limit / Gas限制' },
                  data: { type: 'string', description: 'Transaction data / 交易数据' }
                },
                required: ['to', 'value']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Transaction submitted / 交易已提交',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            hash: { type: 'string' },
                            status: { type: 'string', enum: ['pending'] }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/api/validators': {
      get: {
        tags: ['Validators'],
        summary: 'Get validators / 获取验证节点列表',
        description: 'Retrieve list of network validators / 获取网络验证节点列表',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'inactive', 'jailed'] },
            description: 'Filter by status / 按状态过滤'
          }
        ],
        responses: {
          '200': {
            description: 'Validator list / 验证节点列表',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Validator' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/security/overview': {
      get: {
        tags: ['Security'],
        summary: 'Security overview / 安全概览',
        description: 'Get security system overview / 获取安全系统概览',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Security overview data / 安全概览数据',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '503': {
            description: 'Security service unavailable / 安全服务不可用',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'System',
      description: 'System health and status / 系统健康和状态'
    },
    {
      name: 'Blockchain',
      description: 'Blockchain network operations / 区块链网络操作'
    },
    {
      name: 'Transactions',
      description: 'Transaction management / 交易管理'
    },
    {
      name: 'Validators',
      description: 'Validator node management / 验证节点管理'
    },
    {
      name: 'Security',
      description: 'Security monitoring and control / 安全监控和控制'
    },
    {
      name: 'Authentication',
      description: 'User authentication / 用户认证'
    }
  ]
};

// Generate API documentation middleware / 生成API文档中间件
export function generateApiDocs(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/docs' || req.path === '/api/docs/') {
    // Serve Swagger UI HTML / 提供Swagger UI HTML
    const swaggerHtml = generateSwaggerHTML();
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerHtml);
    return;
  }
  
  if (req.path === '/api/docs/swagger.json') {
    // Serve OpenAPI spec JSON / 提供OpenAPI规范JSON
    res.json(swaggerSpec);
    return;
  }
  
  next();
}

// Generate Swagger UI HTML / 生成Swagger UI HTML
function generateSwaggerHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TitanChain API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #1f2937;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs/swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        validatorUrl: null,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        onComplete: function() {
          console.log('TitanChain API Documentation loaded');
        }
      });
    };
  </script>
</body>
</html>
  `;
}

// Export documentation utilities / 导出文档工具
export const apiDocUtils = {
  generateSpec: () => swaggerSpec,
  generateHTML: generateSwaggerHTML,
  middleware: generateApiDocs
};