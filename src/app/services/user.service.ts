import { Injectable } from '@nestjs/common';
import { CreateUserDTO, EDefault } from '../schema/CreateUserDTO';
import UserEntity from '../db/entities/user.entity';
import ServiceResponse from '../utils/ServiceResponse';
import EMessages from '../enums/EMessages';
import EAccess from '../enums/access.enum';
import LoginDTO from '../schema/LoginDTO';
import AuthService from './auth.service';
import * as bcryprt from 'bcryptjs';
import MealEntity from '../db/entities/meal.entity';
import IUser from '../interfaces/IUser';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';
import { UpdateUserDTO } from '../schema/UpdateUserDTO';

@Injectable()
export class UserService {

  constructor(private readonly authService: AuthService) {}

  async findAll(options: IPaginationOptions): Promise<ServiceResponse> {
    const findOptions = {
      select: ['id', 'userName', 'name', 'access', 'calorie'],
      order: {
        userName: 'ASC',
      },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    };
    const data = await UserEntity.find(findOptions as any);
    if (data.length === 0) {
      return ServiceResponse.error(EMessages.RESOURCE_NOT_FOUND);
    }
    delete findOptions.skip;
    delete findOptions.take;
    const size = (await UserEntity.findAndCount(findOptions as any))[1];
    return ServiceResponse.success(data, EMessages.RESOURCE_FOUND, size);
  }

  async findByUserName(userName: string): Promise<ServiceResponse> {
    const user: UserEntity = await UserEntity.findByUserName(userName);
    if (!user) {
      return ServiceResponse.error(`user \"${userName}\" not found`);
    }
    const data: IUser = user;
    return ServiceResponse.success(data, EMessages.RESOURCE_FOUND, 1);
  }

  async createUser(createUserDTO: CreateUserDTO, thisUser): Promise<ServiceResponse> {
    const user: UserEntity = await UserEntity.findByUserName(createUserDTO.userName);
    if (!user) {
      if (!createUserDTO.password) {
        return ServiceResponse.error(EMessages.INVALID_CREDENTIALS);
      } else {
        if (thisUser.access === EAccess.MANAGER || thisUser.access === 0 || !createUserDTO.access) {
          createUserDTO.access = EAccess.USER;
        }
        const newU: UserEntity = await UserEntity.create(createUserDTO);
        if (createUserDTO.calorie && createUserDTO.calorie > 0) {
          newU.calorie = createUserDTO.calorie;
        } else {
          newU.calorie = EDefault.EXPECTED_CALORIE;
        }
        const data: IUser = await UserEntity.save(newU);
        return ServiceResponse.success(data, EMessages.SUCCESS, 1);
      }
    } else {
      return ServiceResponse.error(EMessages.INVALID_CREDENTIALS + ` : userName \"${createUserDTO.userName}\" already in use`);
    }
  }

  async updateUser(updateUserDTO: UpdateUserDTO, thisUser: UserEntity): Promise<ServiceResponse> {
    const user: UserEntity = await UserEntity.findByUserName(updateUserDTO.userName);
    if (!user) {
      return ServiceResponse.error(EMessages.RESOURCE_NOT_FOUND + `: user \"${updateUserDTO.userName}\" not found`);
    }
    if ( thisUser.access === EAccess.USER ) { // USER
      if ( !updateUserDTO.calorie && !updateUserDTO.password && !updateUserDTO.name) {
        return ServiceResponse.error(EMessages.BAD_REQUEST);
      } else {
        updateUserDTO.userName = thisUser.userName;
        if ( updateUserDTO.password ) {
          user.password = bcryprt.hashSync(updateUserDTO.password, 10);
        }
        if (updateUserDTO.calorie && updateUserDTO.calorie > 0) {
          user.calorie = updateUserDTO.calorie;
        }
        if (updateUserDTO.name) {
          user.name = updateUserDTO.name;
        }
        const data: IUser = await UserEntity.save(user);
        return ServiceResponse.success(data, EMessages.SUCCESS, 1);
      }
    } else if ( thisUser.access === EAccess.MANAGER ) { // MANAGER
      if (!updateUserDTO.calorie
        && (!updateUserDTO.password || updateUserDTO.password === user.password)
        && !updateUserDTO.access
        && !updateUserDTO.name) {
        return ServiceResponse.error(EMessages.BAD_REQUEST);
      } else {
        if (updateUserDTO.password && updateUserDTO.password !== user.password) {
          if (user.access === EAccess.USER || user.userName === thisUser.userName) {
            user.password = bcryprt.hashSync(updateUserDTO.password, 10);
          } else {
            return ServiceResponse.error(EMessages.UNAUTHORIZED_REQUEST);
          }
        }
        if (updateUserDTO.calorie && updateUserDTO.calorie > 0 && user.calorie !== updateUserDTO.calorie) {
          if (user.access === EAccess.USER || user.userName === thisUser.userName) {
            user.calorie = updateUserDTO.calorie;
          } else {
            return ServiceResponse.error(EMessages.UNAUTHORIZED_REQUEST);
          }
        }
        if (updateUserDTO.name && user.name !== updateUserDTO.name) {
          if (user.access === EAccess.USER || user.name === thisUser.name) {
            user.name = updateUserDTO.name;
          } else {
            return ServiceResponse.error(EMessages.UNAUTHORIZED_REQUEST);
          }
        }
        // tslint:disable-next-line:triple-equals
        if (updateUserDTO.access && user.access != updateUserDTO.access) {
          // tslint:disable-next-line:triple-equals
          if (user.access === EAccess.USER && updateUserDTO.access == EAccess.MANAGER) {
            user.access = updateUserDTO.access;
          } else {
            return ServiceResponse.error(EMessages.UNAUTHORIZED_REQUEST);
          }
        }
        const data: IUser = await UserEntity.save(user);
        return ServiceResponse.success(data, EMessages.SUCCESS, 1);
      }
    } else { // ADMIN
      if ( !updateUserDTO.calorie
        && (!updateUserDTO.password || updateUserDTO.password === user.password)
        && !updateUserDTO.access
        && !updateUserDTO.name) {
        return ServiceResponse.error(EMessages.BAD_REQUEST);
      } else {
        if ( updateUserDTO.password && updateUserDTO.password !== user.password ) {
          user.password = bcryprt.hashSync(updateUserDTO.password, 10);
        }
        if ( updateUserDTO.calorie && updateUserDTO.calorie > 0  ) {
          user.calorie = updateUserDTO.calorie;
        }
        if ( updateUserDTO.name ) {
          user.name = updateUserDTO.name;
        }
        if ( updateUserDTO.access && user.userName !== thisUser.userName && updateUserDTO.access in EAccess) {
          user.access = updateUserDTO.access;
        }
        const data: IUser = await UserEntity.save(user);
        return ServiceResponse.success(data, EMessages.SUCCESS, 1);
      }
    }
  }

  async removeUser(userName: string, thisUser: UserEntity): Promise<ServiceResponse> {
    const user: UserEntity = await UserEntity.findByUserName(userName);
    const meals: MealEntity[] = await MealEntity.findByUser(user);
    if (!user) {
      return ServiceResponse.error(EMessages.RESOURCE_NOT_FOUND + ` : user not found : ${userName}`);
    }
// manager can delete user || admin can delete anyone except himself
    if ( (thisUser.access === EAccess.MANAGER && user.access === EAccess.USER)
      || (thisUser.access === EAccess.ADMIN && userName !== thisUser.userName)) {
      await MealEntity.remove(meals);
      await UserEntity.removeUser(userName);
      return ServiceResponse.success('', EMessages.SUCCESS, 1);
    } else {
      return ServiceResponse.error(EMessages.UNAUTHORIZED_REQUEST);
    }
  }

  async login(loginCredentials: LoginDTO): Promise<ServiceResponse> {
    const {userName, password} = loginCredentials;
    const user: UserEntity = await UserEntity.findOne({
      where: {userName},
    });
    if ( !user || !loginCredentials.password) {
      return ServiceResponse.error(EMessages.INVALID_CREDENTIALS);
    }
    const data: IUser = await UserEntity.findByUserName(userName);
    if (await bcryprt.compare(password, user.password)) {
      return ServiceResponse.success(
        {
          jwttoken: await this.authService.generateJWTToken(user),
          user: data,
        }, EMessages.SUCCESS, 1);
    } else {
      return ServiceResponse.error(EMessages.INVALID_CREDENTIALS);
    }
  }
}
