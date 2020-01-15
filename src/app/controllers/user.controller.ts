import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDTO, UpdateUserDTO } from '../schema/user.schema';
import UserEntity from '../db/entities/user.entity';
import EAccess from '../enums/access.enum';
import ServiceResponse from '../utils/ServiceResponse';
import AuthenticationGuard from '../guards/authentication.guard';
import RolesGuard from '../guards/roles.guard';
import { AuthDetails } from '../utils/AuthDetails.decorator';
import LoginDTO from '../schema/access.schema';
import AuthDetail from '../interfaces/AuthDetails';

@Controller('user')
export default class UserController {
  constructor(private readonly userService: UserService) {
  }

  @Post('login')
  async login(@Body() loginCredentials: LoginDTO): Promise<ServiceResponse> {
    return await this.userService.login(loginCredentials);
  }

  @Get()
  @UseGuards(AuthenticationGuard, new RolesGuard([EAccess.MANAGER, EAccess.ADMIN]))
  async findAll(@Query('page') page: number = 0, @Query('limit') limit: number = 10): Promise<ServiceResponse> {
    limit = limit > 100 ? 100 : limit;
    return await this.userService.findAll({page, limit});
  }

  @Get('/:userName')
  @UseGuards(AuthenticationGuard, new RolesGuard([EAccess.USER, EAccess.MANAGER, EAccess.ADMIN]))
  async findById(@Param('userName')userName: string, @AuthDetails() authDetail: AuthDetail): Promise<ServiceResponse> {
    if (authDetail.currentUser.access === EAccess.USER) {
      userName = authDetail.currentUser.userName;
    }
    return await this.userService.findByUserName(userName);
  }

  @Post('/new')
  @UseGuards(AuthenticationGuard, new RolesGuard([EAccess.MANAGER, EAccess.ADMIN]))
  async createUser(@Body() createUserDTO: CreateUserDTO, @AuthDetails() authDetail: AuthDetail): Promise<ServiceResponse> {
    return await this.userService.createUser(createUserDTO, authDetail.currentUser);
  }

  @Post('/signUp')
  async createAccount(@Body() createUserDTO: CreateUserDTO): Promise<ServiceResponse> {
    return await this.userService.createUser(createUserDTO, {access: EAccess.ANONYMOUS});
  }

  @Delete('/remove/:userName')
  @UseGuards(AuthenticationGuard, new RolesGuard([EAccess.MANAGER, EAccess.ADMIN]))
  async removeUser(@Param('userName') userName: string, @AuthDetails() authDetail: AuthDetail): Promise<ServiceResponse> {
    return await this.userService.removeUser(userName, authDetail.currentUser);
  }

  @Put('/update')
  @UseGuards(AuthenticationGuard, new RolesGuard([EAccess.USER, EAccess.MANAGER, EAccess.ADMIN]))
  async updateUser(@Body() updateUserDTO: UpdateUserDTO, @AuthDetails() authDetail: AuthDetail): Promise<ServiceResponse> {
    return await this.userService.updateUser(updateUserDTO, authDetail.currentUser);
  }
}
